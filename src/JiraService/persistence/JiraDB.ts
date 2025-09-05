// src/CustomerAndServiceManager/BazefieldDB.ts

import { JiraProject } from '../JiraServiceManager';

// Adaptateur minimal compatible jqlite / better-sqlite3
export interface SqlLike {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run: (...params: any[]) => unknown;
    all: <T = any>(...params: any[]) => T[];
    get?: <T = any>(...params: any[]) => T | undefined;
  };
}

/**
 * Initialise le schéma "projects" (avec JSON stockés en TEXT).
 * - lead_json: JSON.stringify(lead)
 * - issue_types_json: JSON.stringify(issueTypes)
 * - insight_json: JSON.stringify(insight)
 */
export function initProjectsSchema(db: SqlLike): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS projects (
      id                TEXT PRIMARY KEY,   -- "10308"
      key               TEXT NOT NULL,      -- "PBPD"
      name              TEXT NOT NULL,      -- "Power & Battery Plant Delivery"
      description       TEXT,
      project_type      TEXT,               -- projectTypeKey
      simplified        INTEGER,            -- 0/1
      style             TEXT,               -- "classic" | "next-gen"
      is_private        INTEGER,            -- 0/1
      self_url          TEXT,

      -- JSON sérialisés (texte)
      lead_json         TEXT,               -- JSON.stringify(lead)
      issue_types_json  TEXT,               -- JSON.stringify(issueTypes)
      insight_json      TEXT                -- JSON.stringify(insight)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_key ON projects(key);

    -- (Optionnel) index sur une clé JSON utilisée fréquemment
    -- CREATE INDEX IF NOT EXISTS idx_projects_lead_account
    --   ON projects (json_extract(lead_json, '$.accountId'));
  `);
}

function b(v?: boolean): number | null {
  return typeof v === 'boolean' ? (v ? 1 : 0) : null;
}

/**
 * Upsert d’un projet dans la table "projects".
 * Passe automatiquement en JSON les champs lead/issueTypes/insight.
 */
export function upsertProject(db: SqlLike, p: JiraProject): void {
  const stmt = db.prepare(`
    INSERT INTO projects (
      id, key, name, description, project_type, simplified, style, is_private, self_url,
      lead_json, issue_types_json, insight_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      key               = excluded.key,
      name              = excluded.name,
      description       = excluded.description,
      project_type      = excluded.project_type,
      simplified        = excluded.simplified,
      style             = excluded.style,
      is_private        = excluded.is_private,
      self_url          = excluded.self_url,
      lead_json         = excluded.lead_json,
      issue_types_json  = excluded.issue_types_json,
      insight_json      = excluded.insight_json
  `);

  stmt.run(p.id, p.key, p.name, p.description ?? null, (p as any).projectTypeKey ?? null, b(p.simplified), p.style ?? null, b((p as any).isPrivate), p.self ?? null, JSON.stringify(p.lead ?? null), JSON.stringify(p.issueTypes ?? null), JSON.stringify(p.insight ?? null));
}

/**
 * Exécute une requête SQL arbitraire et retourne toutes les lignes trouvées.
 * @param db connexion SqlLike
 * @param sql texte de la requête (peut contenir des ? comme placeholders)
 * @param params paramètres optionnels
 */
export function runCustomQuery<T = any>(db: SqlLike, sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all<T>(...params);
}
