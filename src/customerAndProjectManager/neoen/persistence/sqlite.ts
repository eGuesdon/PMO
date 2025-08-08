// persistence/sqlite.ts
import Database from "better-sqlite3";

// Types minimaux (adapte si ton JiraPage diffère)
type JiraIssue = { key: string; fields?: any };
type JiraPage  = { issues?: JiraIssue[] };

export function upsertIssues(dbPath: string, pages: JiraPage[]) {
  const db = new Database(dbPath);

  // Petits réglages perf/fiabilité
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  // Schéma minimal si absent
  db.exec(`
    CREATE TABLE IF NOT EXISTS issues_raw(
      key TEXT PRIMARY KEY,
      project TEXT,
      updated_at TEXT,
      payload_json TEXT NOT NULL
    );
  `);

  // UPSERT préparé
  const upsert = db.prepare(`
    INSERT INTO issues_raw (key, project, updated_at, payload_json)
    VALUES (@key, @project, @updated_at, @payload_json)
    ON CONFLICT(key) DO UPDATE SET
      project      = excluded.project,
      updated_at   = excluded.updated_at,
      payload_json = excluded.payload_json
  `);

  // Transaction pour la vitesse
  const insertMany = db.transaction((pagesLocal: JiraPage[]) => {
    for (const page of pagesLocal) {
      for (const issue of page.issues ?? []) {
        const project =
          issue?.fields?.project?.key ??
          (typeof issue?.key === "string" ? issue.key.split("-")[0] : null);

        const updated =
          issue?.fields?.updated ??
          new Date().toISOString();

        upsert.run({
          key: issue.key,
          project,
          updated_at: updated,
          payload_json: JSON.stringify(issue),
        });
      }
    }
  });

  insertMany(pages);
  db.close();
}