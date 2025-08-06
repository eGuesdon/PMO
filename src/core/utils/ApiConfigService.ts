// src/core/utils/ApiConfigService.ts
import { FileLoader, FileMetadata } from './FileLoader';
import { ServiceRegistry } from './ServiceRegistry';
import { EndpointConfig } from './VendorConfigService';

interface VendorEntry {
  vendorName: string;
  configFilePath: string;
}

export class ApiConfigService {
  private static instance: ApiConfigService;
  private entries: VendorEntry[] = [];

  private constructor(private configFilePath: string) {}

  public static async getInstance(configFilePath: string): Promise<ApiConfigService> {
    if (!ApiConfigService.instance) {
      const svc = new ApiConfigService(configFilePath);
      await svc.load();
      ApiConfigService.instance = svc;
    }
    return ApiConfigService.instance;
  }

  private async load(): Promise<void> {
    const meta: FileMetadata = await FileLoader.getInstance().load(this.configFilePath);
    const data = meta.content as any;
    if (!Array.isArray(data.vendors)) {
      throw new Error(`Le fichier ${this.configFilePath} ne contient pas de tableau "vendors".`);
    }
    this.entries = data.vendors.map((v: any) => ({
      vendorName: v.vendorName,
      configFilePath: v.configFilePath,
    }));
  }

  public getAllVendors(): string[] {
    return this.entries.map((e) => e.vendorName);
  }

  // Exposé pour ServiceRegistry
  public get entriesList(): VendorEntry[] {
    return this.entries;
  }

  // Facade simple pour récupérer le service vendor
  public async getVendorService(vendorName: string) {
    return ServiceRegistry.getInstance().getVendorService(this.configFilePath, vendorName);
  }

  public async getEndpoints(vendorName: string): Promise<EndpointConfig[]> {
    const svc = await this.getVendorService(vendorName);
    return svc.getEndpoints();
  }

  public async getEndpoint(vendorName: string, endpointName: string): Promise<EndpointConfig | undefined> {
    const eps = await this.getEndpoints(vendorName);
    return eps.find((e) => e.name.toLowerCase() === endpointName.toLowerCase());
  }

  public async getEndpointsByFamily(vendorName: string, family: string): Promise<EndpointConfig[]> {
    const svc = await this.getVendorService(vendorName);
    return svc.getEndpointsByFamily(family);
  }

  public async getEndpointsNames(vendorName: string) {
    const eps = await this.getEndpoints(vendorName);
    return eps.map((e) => e.name);
  }

  /**
   * Retourne la liste des noms des endpoints d'une famille donnée pour un vendor.
   * @param vendorName Nom du vendor (case-insensitive)
   * @param family Famille d'endpoints (case-insensitive)
   */
  public async getEndpointsNamesByFamily(vendorName: string, family: string): Promise<string[]> {
    const eps = await this.getEndpointsByFamily(vendorName, family);
    return eps.map((e) => e.name);
  }
}
