/**
 * Paramètres de requête pour JQL.
 */
export interface QueryParams {}

export interface GetIssuesQueryParams extends QueryParams {
  jql: string;
  fields?: string[];
}

/** Paramètres pour l’endpoint countIssues. */
export interface CountIssuesQueryParams extends QueryParams {
  jql: string;
}
