/**
 * BazefieldManager – audit wiring & DB evidence test (sans lecture de fichier)
 * Vérifie que initProjects():
 *  - démarre/termine un run d’audit (transport fichier initialisé, HMAC si clé en .env)
 *  - écrit dans audit_sync_run + audit_event (SQLite)
 *  - upsert les projets dans la table projects
 */

import 'dotenv/config';
import BazefieldManager from '../../CustomerAndServiceManager/BazefieldManager';
import AuditService, { FileAuditTransport } from '../../core/utils/AuditService';

// Helpers DB
function q1<T = any>(db: any, sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
function qa<T = any>(db: any, sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

describe('BazefieldManager.initProjects – audit + DB', () => {
  beforeAll(() => {
    // Initialise explicitement l’audit avec un transport fichier.
    // (On ne lit pas le fichier dans ce test : on vérifie uniquement les évidences DB.)
    const transport = new FileAuditTransport('logs/audit.bzf.test.log');
    AuditService.getInstance([transport], process.env.AUDIT_HMAC_KEY);
  });

  it('produit des évidences DB avec une liste de projets mockée', async () => {
    const inst = BazefieldManager.getInstance();

    // Prépare la DB
    await inst.ready();
    const db = (inst as any).getDb ? (inst as any).getDb() : undefined;
    expect(db).toBeTruthy();

    // Mock API: évite les appels réseau
    const stubProjects = [
      {
        id: '20001',
        key: 'BZF1',
        name: 'Bazefield Site 1',
        projectTypeKey: 'software',
        insight: { totalIssueCount: 2, lastIssueUpdateTime: new Date().toISOString() },
        lead: { displayName: 'Carol', active: true },
      },
      {
        id: '20002',
        key: 'BZF2',
        name: 'Bazefield Site 2',
        projectTypeKey: 'business',
        insight: { totalIssueCount: 0, lastIssueUpdateTime: new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString() },
        lead: { displayName: 'Dave', active: false },
      },
    ] as any[];

    const spy = jest.spyOn(inst as any, 'getProjectList').mockResolvedValue(stubProjects);

    // Exécute
    await inst.initProjects();

    // 1) Projets upsertés
    const projRows = qa(db, `SELECT key, name FROM projects ORDER BY key`);
    expect(projRows.length).toBeGreaterThanOrEqual(2);
    expect(projRows.map((r: any) => r.key)).toEqual(expect.arrayContaining(['BZF1', 'BZF2']));

    // 2) Évidence DB (run + events)
    const runRow = q1<{ run_id: string; status: string }>(db, `SELECT run_id, status FROM audit_sync_run ORDER BY started_at_utc DESC LIMIT 1`);
    expect(runRow).toBeTruthy();
    expect(['SUCCESS', 'FAILURE']).toContain(runRow!.status);

    const events = qa<{ step: string }>(db, `SELECT step FROM audit_event WHERE run_id = ?`, runRow!.run_id);
    const steps = events.map((e) => e.step);
    expect(steps).toEqual(expect.arrayContaining(['FETCH_DONE', 'UPSERT_DONE']));

    spy.mockRestore();
  });
});
