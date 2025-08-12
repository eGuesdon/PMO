import { ApiConfigService } from './ApiConfigService';
// import fetch from 'node-fetch'; // or remove if using global fetch on Node 18+
import type { EndpointConfig } from './VendorConfigService';

export interface QueryParams {
  [key: string]: any;
}

export class ApiServiceManager {
  private static instance: ApiServiceManager;
  private apiConfig: ApiConfigService;

  private constructor(apiConfig: ApiConfigService) {
    this.apiConfig = apiConfig;
  }

  public static async getInstance(apiLibPath: string): Promise<ApiServiceManager> {
    if (!ApiServiceManager.instance) {
      const apiConfig = await ApiConfigService.getInstance(apiLibPath);
      ApiServiceManager.instance = new ApiServiceManager(apiConfig);
    }
    return ApiServiceManager.instance;
  }

  /**
   * Récupère les données d'un endpoint en gérant pagination et décodage
   * @param vendorName Nom du vendor (case-insensitive)
   * @param endpointName Nom de l'endpoint (case-insensitive)
   * @param params Paramètres de requête (query/body)
   */
  public async getData<P extends QueryParams = QueryParams>(vendorName: string, endpointName: string, params: P): Promise<any[]> {
    // 1) Récupérer la configuration de l'endpoint
    const endpoint: EndpointConfig | undefined = await this.apiConfig.getEndpoint(vendorName, endpointName);
    if (!endpoint) {
      throw new Error(`Endpoint '${endpointName}' introuvable pour le vendor '${vendorName}'.`);
    }

    // 2) Construire la première requête
    const requestConfig = await this.buildRequestConfig(vendorName, endpoint, params);

    // 3) Gérer la pagination
    const allData = await this.handlePagination(requestConfig, endpoint, vendorName);

    // 4) Décoder les données (ex: dates)
    return this.decodeData(allData);
  }

  /**
   * Prépare URL, headers et body/query en fonction de l'endpoint et des paramètres
   */
  private async buildRequestConfig(vendorName: string, endpoint: EndpointConfig, params: QueryParams): Promise<{ url: string; options: RequestInit }> {
    // Charger la config du vendor pour récupérer baseURL et apiAccess
    const entrySvc = await this.apiConfig.getVendorService(vendorName);
    const entryConfig = entrySvc.getConfig();

    // Remplacer les variables d'environnement dans baseURL
    let baseURL = String(entryConfig.baseURL);
    baseURL = baseURL.replace(/\$\{(\w+)\}/g, (_, v) => process.env[v] || '');

    // Construire l'URL
    const url = new URL(endpoint.path, baseURL);
    if (endpoint.method.toUpperCase() === 'GET' && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          value.forEach((v) => {
            if (v !== undefined && v !== null) url.searchParams.append(key, String(v));
          });
        } else if (typeof value === 'object') {
          // Conserver la structure si l'API attend un JSON (rare en GET), sinon fallback string
          url.searchParams.append(key, JSON.stringify(value));
        } else {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Préparer headers et body si nécessaire
    const headers: Record<string, string> = { ...endpoint.headers };
    let body: string | undefined;
    if (endpoint.method.toUpperCase() !== 'GET') {
      body = JSON.stringify(params);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    // Remplacer les placeholders d'env dans les headers (ex: ${AUTH_HEADER}, ${XYZ})
    Object.keys(headers).forEach((key) => {
      const v = headers[key];
      if (typeof v === 'string') {
        headers[key] = v.replace(/\$\{(\w+)\}/g, (_, envName) => process.env[envName] || '');
      }
    });

    // Si Authorization est demandé via placeholder ou manquant, le construire selon apiAccess
    if (!headers['Authorization'] || headers['Authorization'] === '') {
      headers['Authorization'] = this.buildAuthHeader(entryConfig);
    } else if (headers['Authorization'] === '${AUTH_HEADER}') {
      headers['Authorization'] = this.buildAuthHeader(entryConfig);
    }

    return {
      url: url.toString(),
      options: {
        method: endpoint.method,
        headers,
        body,
      },
    };
  }

  /**
   * Exécute les appels HTTP page par page selon la config de pagination
   */
  private async handlePagination(requestConfig: { url: string; options: RequestInit }, endpoint: EndpointConfig, vendorName: string): Promise<any[]> {
    // 1) déduire la config effective
    let pagCfg = endpoint.pagination;
    if (pagCfg === undefined) {
      const entrySvc = await this.apiConfig.getVendorService(vendorName);
      const entryCfg = entrySvc.getConfig();
      pagCfg = entryCfg.pagination;
    }

    // Normaliser le mode de pagination pour éviter les comparaisons de types non chevauchants
    const pagMode: 'none' | 'pagebean' | 'cursor' | 'offset' | undefined = typeof pagCfg === 'string' ? (pagCfg as any) : pagCfg && typeof pagCfg === 'object' && (pagCfg as any).mode ? ((pagCfg as any).mode as any) : pagCfg && typeof pagCfg === 'object' && (pagCfg as any).cursor ? 'cursor' : pagCfg && typeof pagCfg === 'object' && (pagCfg as any).offset ? 'offset' : undefined;

    // 2) pas de pagination
    if (pagMode === 'none' || pagMode == null) {
      const res = await fetch(requestConfig.url, requestConfig.options);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${endpoint.name}`);
      const json = await res.json();
      return this.extractItems(json, endpoint);
    }

    // 3) pagination pagebean (Jira PageBean: isLast, nextPage, startAt, maxResults, total, values[])
    if (pagMode === 'pagebean') {
      const results: any[] = [];
      let pageUrl = new URL(requestConfig.url);
      const baseUrl = new URL(requestConfig.url); // conserver les params initiaux (expand, status, fields…)

      // On boucle tant que la page courante n'est pas la dernière
      /* eslint-disable no-constant-condition */
      while (true) {
        const res = await fetch(pageUrl.toString(), requestConfig.options);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${endpoint.name}`);
        }
        const payload = await res.json();
        results.push(...this.extractItems(payload, endpoint));

        const isLast: boolean | undefined = payload?.isLast;
        const nextPage: string | undefined = payload?.nextPage;
        const maxResults: number = Number(payload?.maxResults ?? 0);
        const startAt: number = Number(payload?.startAt ?? 0);
        const total: number = Number(payload?.total ?? NaN);
        const valuesLen: number = Array.isArray(payload?.values) ? payload.values.length : 0;

        // Condition d'arrêt prioritaire
        if (isLast === true) {
          break;
        }

        // Préférence: suivre nextPage si fourni par l'API
        if (nextPage) {
          pageUrl = new URL(nextPage);
          // Réinjecter les params initiaux s’ils ont disparu dans nextPage
          baseUrl.searchParams.forEach((val, key) => {
            if (!pageUrl.searchParams.has(key)) {
              pageUrl.searchParams.set(key, val);
            }
          });
          continue;
        }

        // Fallback: calculer startAt suivant
        const increment = maxResults || valuesLen || 0;
        const nextStartAt = startAt + increment;

        // Gardes-fous d'arrêt
        if (Number.isFinite(total) && nextStartAt >= total) {
          break;
        }
        if (maxResults && valuesLen < maxResults) {
          break;
        }
        if (!increment) {
          // aucune progression possible
          break;
        }

        pageUrl.searchParams.set('startAt', String(nextStartAt));
        if (!pageUrl.searchParams.has('maxResults') && maxResults) {
          pageUrl.searchParams.set('maxResults', String(maxResults));
        }
      }

      return results;
    }

    // 4) pagination cursor-based
    if (pagMode === 'cursor' && (pagCfg as any).cursor) {
      const cfg = (pagCfg as any).cursor;
      const results: any[] = [];
      let nextToken: string | null = cfg.initialToken;
      let keepGoing = true;

      while (keepGoing) {
        // construire URL pour cette page
        const pageUrl = new URL(requestConfig.url);
        pageUrl.searchParams.set(cfg.pageSizeField, String(cfg.defaultPageSize));
        if (nextToken) {
          pageUrl.searchParams.set(cfg.nextTokenField, nextToken);
        }

        const res = await fetch(pageUrl.toString(), requestConfig.options);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${endpoint.name}`);
        }
        const payload = await res.json();
        results.push(...this.extractItems(payload, endpoint));

        // décider si on continue
        keepGoing = payload[cfg.lastField] === false;
        nextToken = payload[cfg.nextTokenField] ?? null;
      }

      return results;
    }

    // 5) (optionnel) offset-based à implémenter ultérieurement…

    throw new Error('Type de pagination non supporté.');
  }

  /**
   * Transforme/convertit les données brutes (ex: chaînes de dates -> Date)
   */
  private decodeData(data: any[]): any[] {
    // TODO: implémenter les conversions nécessaires
    return data;
  }

  /**
   * Construit l'en-tête Authorization selon la config d'accès API
   * Règles:
   *  - scheme === 'bearer' -> Bearer <tokenEnv>
   *  - par défaut: si userEnv & tokenEnv -> Basic base64(user:token), sinon si tokenEnv seul -> Bearer
   */
  private buildAuthHeader(entryConfig: any): string {
    const scheme = entryConfig?.apiAccess?.scheme as string | undefined;
    const userEnv = entryConfig?.apiAccess?.userEnv as string | undefined;
    const tokenEnv = entryConfig?.apiAccess?.tokenEnv as string | undefined;

    const user = userEnv ? process.env[userEnv] : undefined;
    const token = tokenEnv ? process.env[tokenEnv] : undefined;

    if (scheme === 'bearer') {
      if (!token) throw new Error('Missing token for bearer scheme');
      return `Bearer ${token}`;
    }

    // Default/fallback behaviour
    if (user && token) {
      const raw = `${user}:${token}`;
      const b64 = Buffer.from(raw, 'utf8').toString('base64');
      return `Basic ${b64}`;
    }
    if (token) {
      return `Bearer ${token}`;
    }
    throw new Error('Missing credentials: cannot build Authorization header');
  }

  private extractItems(payload: any, endpoint: EndpointConfig): any[] {
    let out: any[] | undefined;
    const path = (endpoint as any)?.itemsPath as string | undefined;

    if (path && Array.isArray(payload?.[path])) out = payload[path];
    if (!out) {
      const candidates = ['issues', 'values', 'data', 'elements', 'results', 'items'];
      for (const k of candidates) {
        if (Array.isArray(payload?.[k])) {
          out = payload[k];
          break;
        }
      }
    }
    if (!out) out = Array.isArray(payload) ? payload : [payload];

    if (process.env.JIRA_DEBUG_PAGINATION === '1') {
      console.log('process.env.JIRA_DEBUG_PAGINATION ' + process.env.JIRA_DEBUG_PAGINATION);
      const sampleKeys = Object.keys(out[0] || {}).slice(0, 6);
      // eslint-disable-next-line no-console
      console.log(`[extractItems] ${endpoint.name} path=${path || 'auto'} size=${out.length} sampleKeys=${sampleKeys.join(',')}`);
    }
    return out;
  }
}
