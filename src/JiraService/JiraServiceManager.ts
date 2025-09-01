import 'dotenv/config';
// Utilise l'ApiServiceManager existant pour tous les appels
import { ApiServiceManager } from '../core/utils/ApiServiceManager';
// Import des Query Params (dont GetProjectsQueryParams)
import { GetFieldsQueryParams, GetIssuesQueryParams, GetIssuesTypeQueryParams, GetProjectsQueryParams } from './jiraApiInterfaces/QueryParams';

// --- DB (centralisée ici) ---------------------------------------------------
import Database from 'better-sqlite3';

// Adaptateur minimal utilisé partout (DB en mémoire/disk, jqlite/better-sqlite3)
export interface SqlLike {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run: (...params: any[]) => unknown;
    all: <T = any>(...params: any[]) => T[];
    get?: <T = any>(...params: any[]) => T | undefined;
  };
}

// --- Types (tels que dans ton fichier de base) ------------------------------
export type JiraProject = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  projectCategory: {
    description: string;
    id: string;
    name: string;
    self: string;
  };
  self: string;
  simplified: false;
  style: string;
  issueTypes?: [
    {
      id?: string;
      name?: string;
      hierarchyLevel?: number;
      subtask?: boolean;
    }?,
  ];
  lead?: {
    self?: string;
    accountId?: string;
    accountType?: string;
    displayName?: string;
    active?: boolean;
  } | null;
  insight?: {
    lastIssueUpdateTime?: string;
    totalIssueCount?: number;
  } | null;
  permissions?: {
    canEdit?: boolean;
  };
};

export type JiraInstanceField = {
  id: string;
  name: string;
  schema: {
    type: string;
    custom: string;
    customId?: number;
  };
  description: string;
};

export type JiraIssue = {
  key: string;
  fields?: { updated?: string } & Record<string, unknown>;
};

export type IssueType = {
  avatarId: number;
  description: string;
  entityId: string;
  hierarchyLevel: number;
  iconUrl: string;
  id: string;
  name: string;
  scope: {
    project: {
      id: string;
      key: string;
      name: string;
      self: string;
    };
    type: string;
  };
  self: string;
  subtask: boolean;
};

export type ProjectsPage = { values?: JiraProject[]; isLast?: boolean };
export type IssuesPage = { total?: number; issues?: JiraIssue[] };

// Noms des opérations attendues par ApiServiceManager (provider: 'Atlassian')
const OPS = {
  projectsOp: 'getProjects',
  issuesOp: 'getIssues',
  countIssuesOp: 'countIssues',
  getFields: 'getFields',
  issueTypesForProject: 'getIssueTypesForProject',
} as const;

export default abstract class JiraServiceManager {
  // #1 Singleton
  private static instances = new WeakMap<Function, JiraServiceManager>();
  private apiLibPath: string;

  // #2 DB centralisée + promesse d'init (attendable par les classes filles)
  protected db?: SqlLike;
  private initPromise?: Promise<void>;

  // constructeur privé => singleton
  protected constructor() {
    try {
      this.apiLibPath = process.env.API_LIB ?? '';
      if (!this.apiLibPath) {
        throw new Error("apiLibPath n'existe pas ou est non défini");
      }
    } catch (err) {
      throw err;
    }
  }

  // ---------- Fabriques ----------
  public static getInstance(this: typeof JiraServiceManager): JiraServiceManager {
    let inst = JiraServiceManager.instances.get(this);
    if (!inst) {
      const Ctor: any = this; // safe: nous sommes dans la hiérarchie; ctor protégé ok ici
      inst = new Ctor();
      JiraServiceManager.instances.set(this, inst!);
    }
    return inst!;
  }

  // Signature sync conservée pour compatibilité statique avec les sous-classes
  public static fromEnv(this: typeof JiraServiceManager): JiraServiceManager {
    return this.getInstance();
  }

  /**
   * Fabrique asynchrone qui retourne une instance prête (init() terminé).
   * À utiliser si vous avez besoin que la DB soit déjà initialisée.
   */
  public static async readyFromEnv(this: typeof JiraServiceManager): Promise<JiraServiceManager> {
    const inst = this.getInstance();
    await inst.ready();
    return inst;
  }

  /**
   * Permet d'attendre l'initialisation sur une instance (idempotent).
   */
  public async ready(): Promise<void> {
    await this.init();
  }

  // ---------- Initialisation commune ----------
  /**
   * Crée et attache la base au manager (idempotent).
   * Ici on ne crée PAS de schéma: les classes filles peuvent le faire ensuite.
   */
  protected async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.db) return; // déjà initialisée

      // Si tu veux un fichier sur disque: new Database('bazefield.db')
      const rawDb = new Database(); // ':memory:' par défaut
      this.db = {
        exec: (sql: string) => rawDb.exec(sql),
        prepare: (sql: string) => {
          const stmt = rawDb.prepare(sql);
          return {
            run: (...params: any[]) => stmt.run(...params),
            all: <T = any>(...params: any[]) => stmt.all(...params) as T[],
            get: <T = any>(...params: any[]) => stmt.get(...params) as T | undefined,
          };
        },
      };
    })();

    return this.initPromise;
  }

  /**
   * Accès DB pour les classes filles.
   * Lève une erreur si la DB n'est pas prête (appelez d'abord await this.ready()).
   */
  protected getDb(): SqlLike {
    if (!this.db) {
      throw new Error('DB non initialisée. Appelez await this.ready() ou utilisez readyFromEnv().');
    }
    return this.db;
  }

  // ---------- Accès API Jira ----------
  private async api() {
    return ApiServiceManager.getInstance(this.apiLibPath);
  }

  /**
   * Liste (clé, nom) des projets selon filtres éventuels (GetProjectsQueryParams)
   */
  public async getProjectList(params?: Partial<GetProjectsQueryParams>): Promise<Array<JiraProject>> {
    const projects: JiraProject[] = await (await this.api()).getData('Atlassian', OPS.projectsOp, params ?? {});
    return projects ?? [];
  }

  /**
   * Liste des champs de l'instance Jira
   */
  public async getJiraInstanceFieldList(params?: Partial<GetFieldsQueryParams>): Promise<Array<JiraInstanceField>> {
    const fields: JiraInstanceField[] = await (await this.api()).getData('Atlassian', OPS.getFields, params ?? {});
    return fields ?? [];
  }

  /**
   * Liste des champs pour un ou plusieurs projets (projectIds requis)
   */
  public async getProjectFieldList(params?: Partial<GetFieldsQueryParams>): Promise<Array<JiraInstanceField>> {
    if (params && !params.projectIds) {
      // correction orthographe: fourni (et non fournit)
      throw new Error('Au moins un ID de projet doit être fourni');
    }
    const fields: JiraInstanceField[] = await (await this.api()).getData('Atlassian', OPS.getFields, params ?? {});
    return fields ?? [];
  }

  /**
   * Recherche d'issues
   */
  public async getIssues(params?: Partial<GetIssuesQueryParams>): Promise<Array<JiraIssue>> {
    const issues: JiraIssue[] = await (await this.api()).getData('Atlassian', OPS.issuesOp, params ?? {});
    return issues ?? [];
  }

  /**
   * Types d'issues pour un projet (projectId requis)
   */
  public async getIssueTypesForProject(params?: Partial<GetIssuesTypeQueryParams>): Promise<Array<IssueType>> {
    if (params && !params.projectId) {
      throw new Error('La propriété projectId est obligatoire');
    }
    const issuesType: IssueType[] = await (await this.api()).getData('Atlassian', OPS.issueTypesForProject, params ?? {});
    return issuesType ?? [];
  }
}
