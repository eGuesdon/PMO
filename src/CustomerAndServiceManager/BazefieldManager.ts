import JiraServiceManager, { JiraProject } from '../JiraService/JiraServiceManager';
import { initProjectsSchema, upsertProject, type SqlLike, runCustomQuery } from '../JiraService/persistence/JiraDB';

// Paramètres utilisés pour la récupération des projets BZF
const GetProjectsQueryParams = {
  startAt: 0,
  maxResults: 100,
  status: ['live', 'archived', 'deleted'],
  keys: ['PBP', 'PBPD'],
  expand: 'description,lead,issueTypes,url,projectKeys,permissions,insight',
};

export default class BazefieldManager extends JiraServiceManager {
  private static instance?: BazefieldManager;

  private constructor() {
    super();
  }

  public static getInstance(): BazefieldManager {
    if (!this.instance) {
      this.instance = new BazefieldManager();
    }
    return this.instance;
  }

  // Conserve la signature sync de la classe de base
  public static fromEnv(): BazefieldManager {
    return this.getInstance();
  }

  /**
   * Fabrique asynchrone : garantit que la DB est initialisée (via JiraServiceManager.ready())
   * puis initialise le schéma "projects" et persiste les projets BZF.
   */
  public static async readyFromEnv(): Promise<BazefieldManager> {
    const inst = this.getInstance();
    await inst.ready(); // initialise la DB côté base (idempotent)
    await inst.initProjects(); // schéma + upserts (idempotent côté schéma; upserts idem)
    return inst;
  }

  /**
   * Initialise le schéma "projects" (idempotent) et persiste les projets BZF.
   */
  public async initProjects(): Promise<void> {
    const db = this.getDb(); // hérité de JiraServiceManager
    // 1) créer le schéma (idempotent)
    initProjectsSchema(db);
    // 2) récupérer les projets Jira
    const projects: JiraProject[] = await this.getProjectList(GetProjectsQueryParams);
    // 3) upsert en base
    for (const p of projects) upsertProject(db, p);
  }

  /**
   * Retourne les projets BZF typés (avec parsing des colonnes JSON en objets).
   */
  public getBZFProject(): JiraProject[] {
    const db: SqlLike = this.getDb();

    const rows = runCustomQuery<
      JiraProject & {
        lead_json?: string;
        issue_types_json?: string;
        insight_json?: string;
      }
    >(db, 'SELECT * FROM projects ORDER BY key');

    // Convertir JSON strings vers objets
    return rows.map((row) => ({
      ...row,
      lead: row.lead_json ? JSON.parse(row.lead_json) : undefined,
      issueTypes: row.issue_types_json ? JSON.parse(row.issue_types_json) : undefined,
      insight: row.insight_json ? JSON.parse(row.insight_json) : undefined,
    }));
  }
}
