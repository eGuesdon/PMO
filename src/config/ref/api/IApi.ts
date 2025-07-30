export interface ApiLibrary {
  product?: ProductDefinition;
  confluence?: ProductDefinition;
}

export interface ProductDefinition {
  offer?: string;
  env?: EnvConfig;
  paginationModel?: PaginationModels;
  library?: ApiVersionedLibrary[];
}

export interface EnvConfig {
  domain: string;
  user: string;
  secret: string;
}

export interface PaginationModels {
  'offset-based'?: {
    startAt?: number;
    maxResults?: number;
    start?: number;
    limit?: number;
  };
  'cursor-based'?: {
    isLast: boolean | number;
    nextCursor: string;
  };
}

export interface ApiVersionedLibrary {
  version: number;
  timestamp: string;
  paginationModel: 'offset-based' | 'cursor-based';
  endPoints: EndpointDefinition[];
}

export interface EndpointDefinition {
  name: string;
  'call-sign': string;
  enabled: boolean;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string;
  headers: Record<string, string>;
}
