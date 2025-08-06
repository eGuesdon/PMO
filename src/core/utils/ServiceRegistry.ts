// src/core/utils/ServiceRegistry.ts
import { ApiConfigService } from './ApiConfigService';
import { VendorConfigService } from './VendorConfigService';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private vendorServices: Map<string, VendorConfigService> = new Map();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  public async getVendorService(apiLibPath: string, vendorName: string): Promise<VendorConfigService> {
    const key = vendorName.toLowerCase();

    if (this.vendorServices.has(key)) {
      return this.vendorServices.get(key)!;
    }

    // 1) Charger et parser une seule fois le fichier multi-vendor
    const apiConfig = await ApiConfigService.getInstance(apiLibPath);

    // 2) Récupérer le chemin du fichier de config du vendor
    const entry = apiConfig
      .getAllVendors() // tableau des noms
      .map((name) => name.toLowerCase())
      .includes(key)
      ? apiConfig['entries'].find((e) => e.vendorName.toLowerCase() === key)!
      : undefined;

    if (!entry) {
      throw new Error(`Vendor inconnu : ${vendorName}`);
    }

    const svc = await VendorConfigService.create(entry.configFilePath, vendorName);
    this.vendorServices.set(key, svc);
    return svc;
  }
}
