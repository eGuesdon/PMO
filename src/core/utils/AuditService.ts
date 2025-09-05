import * as fsp from 'fs/promises';
import * as fs from 'fs';
import { createHmac, randomUUID } from 'crypto';
import * as path from 'path';

/**
 * Structure d’un événement d’audit.
 */
export interface AuditEvent {
  timestamp: string; // ISO 8601 UTC
  actor: string; // identifiant du service ou de l’utilisateur
  event: string; // type d’action (p.ex. "FILE_LOADED")
  resource?: string; // cible (chemin de fichier, URL, etc.)
  status?: string; // "SUCCESS" | "FAILURE"
  details?: any; // champ libre pour infos additionnelles
  signature?: string; // HMAC-SHA256 de la ligne JSONL (pour immuabilité)
}

/**
 * Interface d’un transport d’audit (fichier, syslog, DB…).
 */
export interface AuditTransport {
  /**
   * Envoie une entrée d’audit. Ne doit jamais rejeter (erreurs internes capturées).
   */
  log(event: AuditEvent): Promise<void>;
}

/**
 * Transport de base : écrit en JSONL dans un fichier append-only.
 */
export class FileAuditTransport implements AuditTransport {
  private filePath: string;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = filePath;
  }

  async log(event: AuditEvent): Promise<void> {
    try {
      await fsp.appendFile(this.filePath, JSON.stringify(event) + '\n', 'utf-8');
    } catch (err) {
      console.error('AuditTransport(File) error:', err);
    }
  }
}

/**
 * Service d’audit singleton.
 */
export class AuditService {
  private static instance: AuditService;
  private transports: AuditTransport[];
  private hmacKey?: string;

  private constructor(transports: AuditTransport[], hmacKey?: string) {
    this.transports = transports;
    this.hmacKey = hmacKey;
  }

  /**
   * Renvoie l’unique instance.
   * @param transports Liste des transports à utiliser (ex. [new FileAuditTransport(...)])
   * @param hmacKey   Clé secrète pour générer la signature HMAC (optionnel)
   */
  public static getInstance(transports?: AuditTransport[], hmacKey?: string): AuditService {
    if (!AuditService.instance) {
      if (!transports) {
        throw new Error('AuditService must be initialized with transports');
      }
      AuditService.instance = new AuditService(transports, hmacKey);
    }
    return AuditService.instance;
  }

  /**
   * Enregistre un événement d’audit.
   */
  public async log(
    event: Omit<AuditEvent, 'timestamp' | 'signature'> & {
      timestamp?: never;
      signature?: never;
    },
  ): Promise<void> {
    const entry: AuditEvent = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Calcul de la signature
    if (this.hmacKey) {
      const hmac = createHmac('sha256', this.hmacKey);
      hmac.update(JSON.stringify(entry));
      entry.signature = hmac.digest('hex');
    }

    // Envoi à tous les transports et attente de leur complétion
    await Promise.all(this.transports.map((t) => t.log(entry).catch((err) => console.error('AuditService transport error:', err))));
  }

  /**
   * Démarre une exécution (run) et retourne un run_id corrélable.
   * Journalise SYNC_RUN_START.
   */
  public async beginRun(info: { actor: string; adapter?: string; instanceId?: string; params?: any }): Promise<{ runId: string }> {
    const runId = typeof randomUUID === 'function' ? randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.log({
      actor: info.actor,
      event: 'SYNC_RUN_START',
      resource: info.adapter ? `${info.adapter}${info.instanceId ? ':' + info.instanceId : ''}` : undefined,
      status: 'STARTED',
      details: { params: info.params, adapter: info.adapter, instanceId: info.instanceId, run_id: runId },
    });
    return { runId };
  }

  /** Journalise une étape intermédiaire liée à un run (SYNC_STEP). */
  public async logStep(runId: string | undefined, step: string, message?: string, details?: any): Promise<void> {
    if (!runId) return;
    await this.log({
      actor: 'system',
      event: 'SYNC_STEP',
      status: 'INFO',
      details: { step, message, run_id: runId, ...(details ?? {}) },
    });
  }

  /** Termine un run (SYNC_RUN_END) avec statut final. */
  public async endRun(runId: string | undefined, status: 'SUCCESS' | 'FAILURE', error?: unknown): Promise<void> {
    if (!runId) return;
    await this.log({
      actor: 'system',
      event: 'SYNC_RUN_END',
      status,
      details: {
        run_id: runId,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : (error ?? null),
      },
    });
  }
}
