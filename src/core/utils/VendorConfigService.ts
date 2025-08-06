import { FileLoader, FileMetadata } from './FileLoader';

export interface EndpointConfig {
  name: string;
  operationId: string;
  enabled: boolean;
  family?: string;
  path: string;
  method: string;
  headers: Record<string, string>;
}

/**
 * Service spécifique à un vendor,
 * chargé dynamiquement à partir de son fichier de config.
 */
export class VendorConfigService {
  private endpoints: EndpointConfig[];

  private constructor(private metadata: FileMetadata, private vendorName: string) {
    const data = (metadata.content as any).entries;
    if (!Array.isArray(data)) {
      throw new Error(`Le fichier ${metadata.path} ne contient pas de tableau "entries".`);
    }
    const entry = data.find((e: any) => 
      e.vendor?.toLowerCase() === vendorName.toLowerCase()
    );
    if (!entry || !Array.isArray(entry.endpoints)) {
      throw new Error(
        `Le vendor "${vendorName}" n'est pas trouvé ou le tableau "endpoints" est manquant dans ${metadata.path}.`
      );
    }
    this.endpoints = entry.endpoints as EndpointConfig[];
  }

  /**
   * Crée une instance en chargeant le JSON via FileLoader.
   * @param configFilePath Chemin vers le fichier JSON du vendor
   */
  public static async create(
    configFilePath: string,
    vendorName: string
  ): Promise<VendorConfigService> {
    const loader = FileLoader.getInstance();
    const meta: FileMetadata = await loader.load(configFilePath);
    return new VendorConfigService(meta, vendorName);
  }

  /**
   * Retourne tous les endpoints définis pour ce vendor.
   */
  public getEndpoints(): EndpointConfig[] {
    return [...this.endpoints];
  }

  /**
   * Retourne les endpoints d'une famille donnée (case-insensitive).
   * @param family Famille d'endpoints (ex: "search")
   */
  public getEndpointsByFamily(family: string): EndpointConfig[] {
    const key = family.toLowerCase();
    return this.endpoints.filter(e => (e.family ?? '').toLowerCase() === key);
  }
}