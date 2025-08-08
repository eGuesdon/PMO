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
        if (value !== undefined && value !== null) {
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

    // Auth Basic basé sur apiAccess
    if (entryConfig.apiAccess) {
      const login = process.env[entryConfig.apiAccess.userEnv] || '';
      const token = process.env[entryConfig.apiAccess.tokenEnv] || '';
      const basic = 'Basic ' + Buffer.from(`${login}:${token}`).toString('base64');
      headers['Authorization'] = basic;
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

    // 2) pas de pagination
    if (pagCfg === 'none' || pagCfg == null) {
      const res = await fetch(requestConfig.url, requestConfig.options);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${endpoint.name}`);
      const json = await res.json();
      return Array.isArray(json) ? json : [json];
    }

    // 3) pagination cursor-based
    if (pagCfg.cursor) {
      const results: any[] = [];
      let nextToken: string | null = pagCfg.cursor.initialToken;
      let keepGoing = true;

      while (keepGoing) {
        // construire URL pour cette page
        const pageUrl = new URL(requestConfig.url);
        pageUrl.searchParams.set(pagCfg.cursor.pageSizeField, String(pagCfg.cursor.defaultPageSize));
        if (nextToken) {
          pageUrl.searchParams.set(pagCfg.cursor.nextTokenField, nextToken);
        }

        const res = await fetch(pageUrl.toString(), requestConfig.options);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${endpoint.name}`);
        }
        const payload = await res.json();
        // on suppose que la réponse contient un tableau principal (ex: payload.issues ou payload.data)
        // ici on le renvoie tel quel pour être assemblé par l’appelant
        results.push(payload);

        // décider si on continue
        keepGoing = payload[pagCfg.cursor.lastField] === false;
        nextToken = payload[pagCfg.cursor.nextTokenField] ?? null;
      }

      return results;
    }

    // 4) (optionnel) offset-based à implémenter ultérieurement…

    throw new Error('Type de pagination non supporté.');
  }

  /**
   * Transforme/convertit les données brutes (ex: chaînes de dates -> Date)
   */
  private decodeData(data: any[]): any[] {
    // TODO: implémenter les conversions nécessaires
    return data;
  }
}
