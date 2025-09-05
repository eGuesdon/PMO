// src/CustomerAndServiceManager/JiraInstanceManager.ts
import JiraServiceManager, { JiraProject } from '../JiraService/JiraServiceManager';
import { initProjectsSchema, upsertProject, type SqlLike, runCustomQuery } from '../JiraService/persistence/JiraDB';

const AllProjectsQueryParams = {
  startAt: 0,
  maxResults: 1000,
  // pas de keys ici → toute l’instance
  expand: 'description,lead,issueTypes,url,projectKeys,permissions,insight',
};

export default class JiraInstanceManager extends JiraServiceManager {
  private static instance?: JiraInstanceManager;

  private constructor() {
    super();
  }

  public static getInstance(): JiraInstanceManager {
    if (!this.instance) this.instance = new JiraInstanceManager();
    return this.instance;
  }

  // conserve la signature sync comme la classe de base
  public static fromEnv(): JiraInstanceManager {
    return this.getInstance();
  }

  // fabrique async : DB prête + projets persistés
  public static async readyFromEnv(): Promise<JiraInstanceManager> {
    const inst = this.getInstance();
    await inst.ready(); // DB côté base
    await inst.initProjects(); // schéma + upserts instance complète
    return inst;
  }

  // init schéma + persistence des projets de l’instance
  public async initProjects(): Promise<void> {
    const db = this.getDb();
    initProjectsSchema(db);
    const projects: JiraProject[] = await this.getProjectList(AllProjectsQueryParams);
    for (const p of projects) upsertProject(db, p);
  }

  // lecture typée des projets (avec parsing JSON)
  public getInstanceProjects(): JiraProject[] {
    const db: SqlLike = this.getDb();
    const rows = runCustomQuery<JiraProject & { lead_json?: string; issue_types_json?: string; insight_json?: string }>(db, `SELECT * FROM projects ORDER BY key`);
    return rows.map((r) => ({
      ...r,
      lead: r.lead_json ? JSON.parse(r.lead_json) : undefined,
      issueTypes: r.issue_types_json ? JSON.parse(r.issue_types_json) : undefined,
      insight: r.insight_json ? JSON.parse(r.insight_json) : undefined,
    }));
  }

  // ===== KPIs d’instance (exemples rapides) =====

  /** Nombre total de projets */
  public countProjects(): number {
    const db = this.getDb();
    const [row] = runCustomQuery<{ n: number }>(db, `SELECT COUNT(*) AS n FROM projects`);
    return row?.n ?? 0;
  }

  /** Nombre de projets par type (software/business/...) */
  public countProjectsByType(): Array<{ project_type: string | null; n: number }> {
    const db = this.getDb();
    return runCustomQuery(
      db,
      `
      SELECT project_type, COUNT(*) AS n
      FROM projects
      GROUP BY project_type
      ORDER BY n DESC
    `,
    );
  }

  /** Somme des issues (via insight.totalIssueCount) */
  public totalIssuesFromInsight(): number {
    const db = this.getDb();
    const [row] = runCustomQuery<{ total: number }>(
      db,
      `
      SELECT COALESCE(SUM(CAST(json_extract(insight_json, '$.totalIssueCount') AS INTEGER)), 0) AS total
      FROM projects
    `,
    );
    return row?.total ?? 0;
  }

  /** Dernière mise à jour d’issue sur l’instance (max lastIssueUpdateTime) */
  public lastIssueUpdateTime(): string | null {
    const db = this.getDb();
    const [row] = runCustomQuery<{ last: string | null }>(
      db,
      `
      SELECT MAX(json_extract(insight_json, '$.lastIssueUpdateTime')) AS last
      FROM projects
    `,
    );
    return row?.last ?? null;
  }

  /** Nombre de projets avec un lead actif */
  public countProjectsWithActiveLead(): number {
    const db = this.getDb();
    const [row] = runCustomQuery<{ n: number }>(
      db,
      `
      SELECT COUNT(*) AS n
      FROM projects
      WHERE COALESCE(json_extract(lead_json, '$.active'), 0) = 1
    `,
    );
    return row?.n ?? 0;
  }

  // Un Projet est considéré comme actif dès lors qu'au moins une mise à jour a été réalisée dans les 90 jours.
  // Cette mesure doit être complétée par l'activité au niveau des tickets (création, suppression et mise à jour)
  public countActiveProjects(windowDays = 90): number {
    const db = this.getDb();
    const [row] = runCustomQuery<{ n: number }>(
      db,
      `
    SELECT COUNT(*) AS n
    FROM projects
    WHERE COALESCE(CAST(json_extract(insight_json, '$.totalIssueCount') AS INTEGER), 0) > 0
      AND json_extract(insight_json, '$.lastIssueUpdateTime') >= datetime('now', ?)
  `,
      [`-${windowDays} days`],
    );
    return row?.n ?? 0;
  }

  /**
   * Retourne l'historique de création des projets avec un indicateur d'activité.
   * Structure: [{ project_name, created, is_active }]
   * - created: ISO ou NULL si non disponible en base
   * - is_active: règle identique à countActiveProjects, paramétrable via windowDays
   */
  public projectCreationHistory(windowDays = 30): Array<{ project_name: string; created: string | null; is_active: boolean }> {
    const db = this.getDb();

    // Détecte une éventuelle colonne de création (created_at ou created)
    const cols = runCustomQuery<{ name: string }>(db, `PRAGMA table_info(projects)`);
    const createdCol = cols.find((c) => c.name === 'created_at')?.name || cols.find((c) => c.name === 'created')?.name;

    const selectCreated = createdCol ? createdCol : 'NULL';

    const rows = runCustomQuery<{ project_name: string; created: string | null; is_active: number }>(
      db,
      `SELECT 
         name AS project_name,
         ${selectCreated} AS created,
         CASE 
           WHEN COALESCE(CAST(json_extract(insight_json, '$.totalIssueCount') AS INTEGER), 0) > 0
            AND json_extract(insight_json, '$.lastIssueUpdateTime') >= datetime('now', ?)
           THEN 1 ELSE 0
         END AS is_active
       FROM projects
       ORDER BY name`,
      `-${windowDays} days`,
    );

    return rows.map((r) => ({
      project_name: r.project_name,
      created: r.created ?? null,
      is_active: !!r.is_active,
    }));
  }
}
