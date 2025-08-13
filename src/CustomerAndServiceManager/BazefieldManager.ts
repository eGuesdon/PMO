import JiraServiceManager, { JiraProject, JiraInstanceField, JiraIssue, IssueType } from '../JiraService/JiraServiceManager';

const BZFProjects = {
  PBP: 'Power & Battery Plant',
  PBPD: 'Power & Battery Plant Delivery',
};

export default class BazefieldManager extends JiraServiceManager {
  private static instance?: BazefieldManager;
  private isSyncing = false;
  private autoRefreshTimer?: NodeJS.Timeout;
  private bzfData?: {
    projects: Record<string, JiraProject>;
    fields: Record<string, JiraInstanceField[]>;
    issueTypes: Record<string, IssueType[]>;
    issues: Record<string, JiraIssue[]>;
    parentChildren: Record<string, string[]>;
  };

  private constructor(apiLibPath?: string) {
    super(apiLibPath);
  }

  public static getInstance(apiLibPath?: string): BazefieldManager {
    return super.getInstance(apiLibPath) as BazefieldManager;
  }

  public static fromEnv(): BazefieldManager {
    return this.getInstance(process.env.API_LIB);
  }

  /**
   * Rafraîchit immédiatement les données Bazefield (synchro unique).
   */
  public async refreshBazefieldData(): Promise<void> {
    await this.syncBazefieldData();
  }

  /**
   * Démarre un rafraîchissement automatique toutes les 30 minutes (par défaut).
   * @param intervalMs Intervalle en millisecondes (par défaut: 30 minutes)
   */
  public startAutoRefresh(intervalMs: number = 30 * 60 * 1000): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => {
      // on déclenche sans await pour ne pas bloquer la boucle d'événements
      this.syncBazefieldData().catch((err) => {
        // journaliser proprement si besoin
        console.error('[BazefieldManager][autoRefresh] Sync error:', err?.message ?? err);
      });
    }, intervalMs);
  }

  /**
   * Stoppe le rafraîchissement automatique.
   */
  public stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
  }

  public async syncBazefieldData(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      // 1) Récupérer tous les projets puis filtrer par noms (PBP, PBPD)
      const allProjects: JiraProject[] = await this.getProjectList();
      const targetProjectNames = Object.values(BZFProjects);
      const targetProjects = allProjects.filter((p) => targetProjectNames.includes(p.name));

      if (targetProjects.length !== targetProjectNames.length) {
        const found = targetProjects.map((p) => p.name).join(', ');
        throw new Error(`[BazefieldManager] Projets introuvables ou incomplets. Attendus=${targetProjectNames.join(' | ')}, trouvés=${found || 'aucun'}`);
      }

      // Map projet par nom (pour accès facile PBP/PBPD)
      const projectsByName: Record<string, JiraProject> = {};
      for (const p of targetProjects) {
        projectsByName[p.name] = p;
      }

      // 2) Récupérer les fields pour les deux projets
      const projectIds = targetProjects.map((p) => p.id);
      const fields = await this.getProjectFieldList({ projectIds } as any); // typage de la query côté API
      // Normaliser par projet (chaque projet récupère la même liste quand on appelle par lot)
      const fieldsByProject: Record<string, JiraInstanceField[]> = {};
      for (const p of targetProjects) {
        fieldsByProject[p.id] = fields;
      }

      // 3) Récupérer les issue types pour chaque projet
      const issueTypesByProject: Record<string, IssueType[]> = {};
      for (const p of targetProjects) {
        const types = (await (this as any).getIssueTypesForProject(p.id)) as IssueType[];
        issueTypesByProject[p.id] = types ?? [];
      }

      // 4) Récupérer les issues des deux projets (en une fois via JQL si supporté, sinon par projet)
      const projectKeys = targetProjects.map((p) => p.key).join(', ');
      let issues: JiraIssue[] = [];
      try {
        issues = await this.getIssues({
          jql: `project in (${projectKeys}) ORDER BY updated DESC`,
          fields: ['key', 'project', 'parent', 'issuetype', 'summary', 'issuelinks', 'status', 'updated', 'created'],
          maxResults: 10000,
        } as any);
      } catch {
        // fallback: par projet
        const perProjectIssues: JiraIssue[][] = [];
        for (const p of targetProjects) {
          const res = await this.getIssues({ projectIds: [p.id], maxResults: 10000 } as any);
          perProjectIssues.push(res ?? []);
        }
        issues = ([] as JiraIssue[]).concat(...perProjectIssues);
      }

      // 5) Construire la hiérarchie parent/enfants (basée sur le champ parent)
      const parentChildren: Record<string, string[]> = {};
      const issuesByProject: Record<string, JiraIssue[]> = {};
      for (const p of targetProjects) {
        issuesByProject[p.id] = [];
      }

      for (const issue of issues ?? []) {
        // répartir par projet si possible
        const projectId = (issue as any)?.fields?.project?.id ?? (issue as any)?.fields?.projectId;
        if (projectId && issuesByProject[projectId]) {
          issuesByProject[projectId].push(issue);
        }

        const parentKey = (issue as any)?.fields?.parent?.key as string | undefined;
        const selfKey = (issue as any)?.key as string | undefined;
        if (parentKey && selfKey) {
          const list = parentChildren[parentKey] ?? (parentChildren[parentKey] = []);
          if (!list.includes(selfKey)) list.push(selfKey);
        }
      }

      // 6) Écrire le snapshot local
      this.bzfData = {
        projects: projectsByName,
        fields: fieldsByProject,
        issueTypes: issueTypesByProject,
        issues: issuesByProject,
        parentChildren,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}
