/**
 * Structure d’une page de résultat JIRA.
 */
export interface JiraPage<T = any> {
  /** Tableau des résultats (issues) */
  issues: T[];
  /** Token pour la page suivante (cursor-based paging) */
  nextPageToken?: string;
  /** Indique si c’est la dernière page */
  isLast?: boolean;
}