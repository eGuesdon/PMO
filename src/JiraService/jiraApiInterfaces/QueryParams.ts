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

/** Paramètres pour l’endpoint getFields. */
export interface GetFieldsQueryParams extends QueryParams {}

/** Paramètres pour l’endpoint Project/search. */
export interface GetProjectsQueryParams extends QueryParams {
  startAt?: number;
  maxResults?: number;
  orderBy?: string;
  id?: string[];
  keys?: string[];
  query?: string;
  typeKey: string;
  categoryId: number;
  status?: string[];
  expand?: string;
}

export interface GetFieldsQueryParams extends QueryParams {
  startAt?: number;
  maxResults?: number;
  type?: string[];
  id?: string[];
  query?: string;
  orderBy: string;
  expand: string;
  projectIds: number[];
}

export interface GetIssuesTypeQueryParams extends QueryParams {
  projectId: number;
  level?: number;
}
