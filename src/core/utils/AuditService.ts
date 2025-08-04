import * as fsp from 'fs/promises';
import * as fs from 'fs';
import { createHmac } from 'crypto';
import * as path from 'path';

/**
 * Structure d’un événement d’audit.
 */
export interface AuditEvent {
  timestamp: string;      // ISO 8601 UTC
  actor: string;          // identifiant du service ou de l’utilisateur
  event: string;          // type d’action (p.ex. "FILE_LOADED")
  resource?: string;      // cible (chemin de fichier, URL, etc.)
  status?: string;        // "SUCCESS" | "FAILURE"
  details?: any;          // champ libre pour infos additionnelles
  signature?: string;     // HMAC-SHA256 de la ligne JSONL (pour immuabilité)
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
  public static getInstance(
    transports: AuditTransport[],
    hmacKey?: string
  ): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService(transports, hmacKey);
    }
    return AuditService.instance;
  }

  /**
   * Enregistre un événement d’audit.
   */
  public async log(event: Omit<AuditEvent, 'timestamp' | 'signature'> & {
    timestamp?: never;
    signature?: never;
  }): Promise<void> {
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
    await Promise.all(
      this.transports.map(t =>
        t.log(entry).catch(err =>
          console.error('AuditService transport error:', err)
        )
      )
    );
  }
}