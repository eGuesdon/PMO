// src/core/utils/AuditService.ts
import fs from 'fs';
import path from 'path';
import { createHmac, randomUUID } from 'crypto';

/** Transport d'audit générique */
export interface AuditTransport {
  write(entry: unknown): Promise<void>;
}

/** Transport fichier (JSONL) – crée le dossier si besoin */
export class FileAuditTransport implements AuditTransport {
  private stream: fs.WriteStream;

  constructor(private filePath: string) {
    const dir = path.dirname(filePath);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    this.stream = fs.createWriteStream(this.filePath, { flags: 'a' });
  }

  async write(entry: unknown): Promise<void> {
    this.stream.write(JSON.stringify(entry) + '\n');
  }
}

/** Entrée de log (canonique) */
export interface AuditEvent {
  timestamp: string; // ISO
  actor?: string;
  event: string; // SYNC_RUN_START, SYNC_STEP, SYNC_RUN_END, ...
  status?: string; // STARTED, INFO, SUCCESS, FAILURE, ...
  resource?: string;
  details?: any;
  hmac?: string; // signature HMAC-SHA256 (si clé fournie)
}

/** JSON stable (ordre des clés trié) pour un HMAC déterministe */
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const props = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${props.join(',')}}`;
}

/** Service d'audit (singleton) */
export class AuditService {
  private static instance?: AuditService;
  private transports: AuditTransport[] = [];
  private hmacKey?: string;

  private constructor(transports: AuditTransport[], hmacKey?: string) {
    this.transports = transports;
    this.hmacKey = hmacKey;
  }

  /**
   * Récupère l'instance. Au premier appel, il faut fournir au moins un transport.
   * Si aucune clé n'est fournie, on regarde process.env.AUDIT_HMAC_KEY.
   * Si l'instance existante n'a pas de clé et qu'une clé arrive plus tard, on l’enregistre.
   */
  public static getInstance(transports?: AuditTransport[], hmacKey?: string): AuditService {
    const effectiveKey = hmacKey ?? process.env.AUDIT_HMAC_KEY;

    if (!AuditService.instance) {
      // 🚨 fallback si rien n’est passé et que AUDIT_ENABLED=1
      if ((!transports || transports.length === 0) && process.env.AUDIT_ENABLED === '1') {
        const logFile = process.env.AUDIT_LOG_FILE || 'logs/audit.log';
        transports = [new FileAuditTransport(logFile)];
      }

      if (!transports || transports.length === 0) {
        throw new Error('AuditService must be initialized with transports at first call');
      }

      AuditService.instance = new AuditService(transports, effectiveKey);
      return AuditService.instance;
    }

    // mise à jour paresseuse si pas de clé
    if (!AuditService.instance.hmacKey && effectiveKey) {
      AuditService.instance.hmacKey = effectiveKey;
    }
    return AuditService.instance;
  }

  /**
   * Configuration simplifiée via variables d’environnement.
   * Utilise AUDIT_ENABLED, AUDIT_LOG_FILE, AUDIT_HMAC_KEY.
   * Ne fait rien si AUDIT_ENABLED !== '1'.
   */
  public static configureFromEnv(transports?: AuditTransport[]): void {
    if (process.env.AUDIT_ENABLED !== '1') return;
    const logFile = process.env.AUDIT_LOG_FILE || 'logs/audit.log';
    const ts = transports && transports.length > 0 ? transports : [new FileAuditTransport(logFile)];
    AuditService.getInstance(ts, process.env.AUDIT_HMAC_KEY);
  }

  /** Écrit une entrée */
  public async log(event: Omit<AuditEvent, 'timestamp'> & { timestamp?: never }): Promise<void> {
    const base: AuditEvent = {
      timestamp: new Date().toISOString(),
      actor: event.actor,
      event: event.event,
      status: event.status,
      resource: event.resource,
      details: event.details,
    };

    // Signe sans inclure le champ hmac lui-même
    if (this.hmacKey) {
      const { hmac: _h, ...toSign } = base as any;
      const payload = stableStringify(toSign);
      const mac = createHmac('sha256', this.hmacKey).update(payload).digest('hex');
      (base as any).hmac = mac;
    }

    // Diffuse à tous les transports
    await Promise.all(this.transports.map((t) => t.write(base)));
  }

  /** Démarre un run et retourne runId */
  public async beginRun(info: { actor: string; adapter?: string; instanceId?: string; params?: any }): Promise<{ runId: string }> {
    const runId = typeof randomUUID === 'function' ? randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await this.log({
      actor: info.actor,
      event: 'SYNC_RUN_START',
      status: 'STARTED',
      resource: info.adapter ? `${info.adapter}${info.instanceId ? ':' + info.instanceId : ''}` : undefined,
      details: { params: info.params, adapter: info.adapter, instanceId: info.instanceId, run_id: runId },
    });
    return { runId };
  }

  /** Étape intermédiaire liée à un run */
  public async logStep(runId: string | undefined, step: string, message?: string, details?: any): Promise<void> {
    if (!runId) return;
    await this.log({
      actor: 'system',
      event: 'SYNC_STEP',
      status: 'INFO',
      details: { step, message, run_id: runId, ...(details ?? {}) },
    });
  }

  /** Termine un run */
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

export default AuditService;
