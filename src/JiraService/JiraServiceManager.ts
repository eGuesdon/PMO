import 'dotenv/config';
// Utilise l'ApiServiceManager existant pour tous les appels
import { ApiServiceManager } from '../core/utils/ApiServiceManager';
// Import des Query Params (dont GetProjectsQueryParams)
import { GerFieldsQueryParmas, GetProjectsQueryParams } from './jiraApiInterfaces/QueryParams';

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

export type ProjectWithStatus = JiraProject & { status: 'live' | 'archived' };

export type JiraIssue = {
  key: string;
  fields?: { updated?: string } & Record<string, unknown>;
};

export type ProjectsPage = { values?: JiraProject[]; isLast?: boolean };
export type IssuesPage = { total?: number; issues?: JiraIssue[] };

// Noms des opérations attendues par ApiServiceManager (provider: 'Atlassian')
const OPS = {
  projectsOp: 'getProjects',
  issuesOp: 'getIssues',
  countIssuesOp: 'countIssues',
  getFields: 'getFields',
} as const;

export default class JiraServiceManager {
  // #1 Singleton
  private static instance: JiraServiceManager | null = null;
  private apiLibPath: string;
  private cachedAll: ProjectWithStatus[] | null = null;
  private cachedSignature: string | null = null;

  // constructeur privé => singleton
  private constructor(apiLibPath?: string) {
    this.apiLibPath = apiLibPath ?? process.env.API_LIB ?? '';
    if (!this.apiLibPath) {
      throw new Error('API_LIB manquant (dotenv)');
    }
  }

  static getInstance(apiLibPath?: string) {
    if (!this.instance) this.instance = new JiraServiceManager(apiLibPath);
    return this.instance;
  }

  static fromEnv() {
    return JiraServiceManager.getInstance(process.env.API_LIB);
  }

  private async api() {
    return ApiServiceManager.getInstance(this.apiLibPath);
  }

  /** Invalide le cache interne des projets. */
  public invalidateProjectCache() {
    this.cachedAll = null;
    this.cachedSignature = null;
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
  public async getJiraInstanceFieldList(params?: Partial<GerFieldsQueryParmas>): Promise<Array<JiraInstanceField>> {
    const fields: JiraInstanceField[] = await (await this.api()).getData('Atlassian', OPS.getFields, params ?? {});
    return fields ?? [];
  }

  // --- Pack "première heure" ----------------------------------------------
  public async quickSnapshot(params?: Partial<GetProjectsQueryParams>) {}
}
