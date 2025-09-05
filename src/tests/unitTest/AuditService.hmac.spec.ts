import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import AuditService, { FileAuditTransport } from '../../core/utils/AuditService';

describe('AuditService – HMAC', () => {
  const logDir = 'logs';
  const logFile = path.join(logDir, 'audit.hmac.test.log');

  beforeAll(() => {
    fs.mkdirSync(logDir, { recursive: true });
    try {
      fs.unlinkSync(logFile);
    } catch {}
    // Initialise explicitement l’audit avec un transport fichier
    const t = new FileAuditTransport(logFile);
    AuditService.getInstance([t], process.env.AUDIT_HMAC_KEY);
  });

  it('écrit des lignes signées quand la clé est présente', async () => {
    const svc = AuditService.getInstance();
    const { runId } = await svc.beginRun({ actor: 'test', adapter: 'unit' });
    await svc.logStep(runId, 'STEP', 'hello');
    await svc.endRun(runId, 'SUCCESS');

    const raw = fs.readFileSync(logFile, 'utf-8').trim();
    expect(raw.length).toBeGreaterThan(0);
    const entries = raw.split('\n').map((l) => JSON.parse(l));
    // si la clé est chargée depuis .env, on doit voir un HMAC
    if (process.env.AUDIT_HMAC_KEY) {
      expect(entries.every((e) => typeof e.hmac === 'string' && e.hmac.length > 0)).toBe(true);
    }
  });
});
