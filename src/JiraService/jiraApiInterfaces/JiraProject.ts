export interface ProjectPage<T = any> {
  values: T[];
  maxResults?: number;
  startAt?: number;
  total?: number;
  isLast?: boolean;
}