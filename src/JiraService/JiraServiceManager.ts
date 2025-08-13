import 'dotenv/config';
// Utilise l'ApiServiceManager existant pour tous les appels
import { ApiServiceManager } from '../core/utils/ApiServiceManager';
// Import des Query Params (dont GetProjectsQueryParams)
import { GetFieldsQueryParams, GetIssuesQueryParams, GetIssuesTypeQueryParams, GetProjectsQueryParams } from './jiraApiInterfaces/QueryParams';

// --- Types (minimaux, adaptés à l'usage) -----------------------------------
export type JiraProject = {
  id: string;
  key: string;
  name: string;
  lead?: {
    self?: string;
    accountId?: string;
    accountType?: string;
    displayName?: string;
    active?: boolean;
    avatarUrls?: Record<string, string>;
  } | null;
  insight?: {
    lastIssueUpdateTime?: string;
    totalIssueCount?: number;
  } | null;
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

  // constructeur privé => singleton
  protected constructor(apiLibPath?: string) {
    this.apiLibPath = apiLibPath ?? process.env.API_LIB ?? '';
    if (!this.apiLibPath) {
      throw new Error('API_LIB manquant (dotenv)');
    }
  }

  static getInstance(this: typeof JiraServiceManager, apiLibPath?: string): JiraServiceManager {
    let inst = JiraServiceManager.instances.get(this) as JiraServiceManager | undefined;
    if (!inst) {
      const Ctor: any = this; // safe: we are inside the class hierarchy, protected ctor is callable here
      inst = new Ctor(apiLibPath);
      JiraServiceManager.instances.set(this, inst!);
    }
    return inst!;
  }

  public static fromEnv(this: typeof JiraServiceManager): JiraServiceManager {
    return this.getInstance(process.env.API_LIB);
  }

  private async api() {
    return ApiServiceManager.getInstance(this.apiLibPath);
  }

  /**
   *
   * Liste (clé, nom) des projets selon filtres éventuels (GetProjectsQueryParams)
   * @param params
   * @returns
   */
  public async getProjectList(params?: Partial<GetProjectsQueryParams>): Promise<Array<JiraProject>> {
    const projects: JiraProject[] = await (await this.api()).getData('Atlassian', OPS.projectsOp, params ?? {});
    return projects ?? [];
  }

  /**
   *
   * @param key
   * @param params
   * @returns
   */
  public async getProjectByKey(key: string, params?: Partial<GetProjectsQueryParams>): Promise<JiraProject> {
    const projects: JiraProject[] = await this.getProjectList(params);
    const projet: JiraProject | undefined = projects.find((element) => element.key == key);
    return projet as JiraProject;
  }

  /**
   *
   * @param id
   * @param params
   * @returns
   */
  public async getProjectById(id: string, params?: Partial<GetProjectsQueryParams>): Promise<JiraProject> {
    const projects: JiraProject[] = await this.getProjectList(params);
    const projet: JiraProject | undefined = projects.find((element) => element.id == id);
    return projet as JiraProject;
  }

  /**
   *
   * @param params
   * @returns
   */
  public async getJiraInstanceFieldList(params?: Partial<GetFieldsQueryParams>): Promise<Array<JiraInstanceField>> {
    const fields: JiraInstanceField[] = await (await this.api()).getData('Atlassian', OPS.getFields, params ?? {});
    return fields ?? [];
  }

  /**
   *
   * @param params
   * @returns
   */
  public async getProjectFieldList(params?: Partial<GetFieldsQueryParams>): Promise<Array<JiraInstanceField>> {
    if (params && !params.projectIds) {
      throw new Error('Au moins un ID de projet doit être fournit');
    }
    const fields: JiraInstanceField[] = await (await this.api()).getData('Atlassian', OPS.getFields, params ?? {});
    return fields ?? [];
  }

  /**
   *
   * @param params
   * @returns
   */
  public async getIssues(params?: Partial<GetIssuesQueryParams>): Promise<Array<JiraIssue>> {
    const issues: JiraIssue[] = await (await this.api()).getData('Atlassian', OPS.issuesOp, params ?? {});
    return issues ?? [];
  }

  /**
   *
   * @param params
   * @returns
   */
  public async getIssueTypesForProject(params?: Partial<GetIssuesTypeQueryParams>): Promise<Array<IssueType>> {
    if (params && !params.projectId) {
      throw new Error('La propriété projectId est obligatoire');
    }
    const issuesType: IssueType[] = await (await this.api()).getData('Atlassian', OPS.issueTypesForProject, params ?? {});
    return issuesType ?? [];
  }

  // --- Pack "première heure" ----------------------------------------------
  public async quickSnapshot(params?: Partial<GetProjectsQueryParams>) {}
}
