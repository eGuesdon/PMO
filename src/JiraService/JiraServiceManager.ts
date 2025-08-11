import 'dotenv/config';
// Utilise l'ApiServiceManager existant pour tous les appels
import { ApiServiceManager } from '../core/utils/ApiServiceManager';
// Import des Query Params (dont GetProjectsQueryParams)
import { GetProjectsQueryParams } from './jiraApiInterfaces/QueryParams';

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
} as const;

export class JiraServiceManager {
  // #1 Singleton
  private static instance: JiraServiceManager | null = null;
  private apiLibPath: string;
  private cachedAll: ProjectWithStatus[] | null = null;

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

  private async fetchProjects(params: Partial<GetProjectsQueryParams>): Promise<JiraProject[]> {
    const qp: GetProjectsQueryParams = {
      expand: params.expand ?? 'insight,lead',
      ...(params as any),
    } as GetProjectsQueryParams;
    const pages: ProjectsPage[] = await (await this.api()).getData('Atlassian', OPS.projectsOp, qp);
    return (pages ?? []).flatMap((p) => p?.values ?? []);
  }

  /** Retourne les projets pour un statut donné (live/archived) et marque le statut localement. */
  async getProjectsByStatus(status: 'live' | 'archived', params?: Partial<GetProjectsQueryParams>): Promise<ProjectWithStatus[]> {
    const list = await this.fetchProjects({ ...(params || {}), status: [status] } as any);
    return list.map((p) => ({ ...p, status }));
  }

  /** Récupère tous les projets (live + archived), avec un statut calculé. Mise en cache. */
  async getAllProjectsWithStatus(params?: Partial<GetProjectsQueryParams>): Promise<ProjectWithStatus[]> {
    if (this.cachedAll) return this.cachedAll;
    const [live, archived] = await Promise.all([this.getProjectsByStatus('live', params), this.getProjectsByStatus('archived', params)]);
    this.cachedAll = [...live, ...archived];
    return this.cachedAll;
  }

  // --- Projets --------------------------------------------------------------
  /**
   * Récupère tous les projets via project/search, avec `expand=insight,lead` par défaut.
   * Met la liste en cache.
   */
  async getAllProjects(params?: Partial<GetProjectsQueryParams>): Promise<JiraProject[]> {
    const all = await this.getAllProjectsWithStatus(params);
    return all as JiraProject[]; // on ignore la balise status pour cet alias
  }

  /** Projets "live" = non archivés (si le champ existe), sinon tous. */
  async getLiveProjects(params?: Partial<GetProjectsQueryParams>): Promise<JiraProject[]> {
    const all = await this.getAllProjectsWithStatus(params);
    return all.filter((p) => p.status === 'live');
  }

  /** Nombre de projets live. */
  async getLiveProjectCount(params?: Partial<GetProjectsQueryParams>): Promise<number> {
    return (await this.getLiveProjects(params)).length;
  }

  /** Liste (clé, nom) des projets live. */
  async listLiveProjects(params?: Partial<GetProjectsQueryParams>): Promise<Array<{ key: string; name: string; totalIssueCount?: number; leadName?: string }>> {
    return (await this.getLiveProjects(params)).map((p) => ({ key: p.key, name: p.name, totalIssueCount: p.insight?.totalIssueCount, leader: p.lead?.displayName }));
  }

  /** Projets groupés par lead (displayName/compte). */
  async listProjectsByLead(params?: Partial<GetProjectsQueryParams>): Promise<Record<string, Array<{ key: string; name: string }>>> {
    const all = await this.getAllProjectsWithStatus(params);
    const out: Record<string, Array<{ key: string; name: string }>> = {};
    for (const p of all) {
      const label = p.lead?.displayName ?? p.lead?.accountId ?? (p.lead ? 'Unknown lead' : 'Unassigned');
      (out[label] ||= []).push({ key: p.key, name: p.name });
    }
    return out;
  }

  // --- Issues / métriques par projet ---------------------------------------
  /** Nombre d'issues pour un projet donné (préfère insight.totalIssueCount si dispo). */
  async getIssueCountByProject(projectKey: string): Promise<number> {
    const fromCache = this.cachedAll?.find((p) => p.key === projectKey)?.insight?.totalIssueCount;
    if (typeof fromCache === 'number') return fromCache;

    // fallback par /search (total)
    const pages: IssuesPage[] = await (await this.api()).getData('Atlassian', OPS.issuesOp, { jql: `project = ${projectKey}`, maxResults: 0 });
    return pages?.[0]?.total ?? 0;
  }

  /** Nombre d'issues pour plusieurs projets. */
  async getIssueCountsByProject(keys: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const k of keys) out[k] = await this.getIssueCountByProject(k);
    return out;
  }

  /** Dernière date de mise à jour par projet (préfère insight.lastIssueUpdateTime). */
  async getLastUpdatedByProject(keys: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    for (const k of keys) {
      const cached = this.cachedAll?.find((p) => p.key === k)?.insight?.lastIssueUpdateTime ?? null;
      if (cached) {
        out[k] = cached;
        continue;
      }
      const pages: IssuesPage[] = await (
        await this.api()
      ).getData('Atlassian', OPS.issuesOp, {
        jql: `project = ${k} ORDER BY updated DESC`,
        fields: ['updated'],
        maxResults: 1,
      });
      out[k] = pages?.[0]?.issues?.[0]?.fields?.updated ?? null;
    }
    return out;
  }

  // --- Pack "première heure" ----------------------------------------------
  async quickSnapshot(params?: Partial<GetProjectsQueryParams>) {
    const live = await this.getLiveProjects(params);
    const keys = live.map((p) => p.key);

    const [byLead, issueCounts, lastUpdated] = await Promise.all([this.listProjectsByLead(params), this.getIssueCountsByProject(keys), this.getLastUpdatedByProject(keys)]);

    return {
      liveProjectCount: live.length,
      liveProjects: live.map((p) => ({ key: p.key, name: p.name })),
      projectsByLead: byLead,
      issuesByProject: issueCounts,
      lastUpdatedByProject: lastUpdated,
    } as const;
  }
}

export default JiraServiceManager;
