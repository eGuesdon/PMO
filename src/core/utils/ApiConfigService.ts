import { FileLoader, FileMetadata } from './FileLoader';

/**
 * Représente une entrée de configuration pour un vendor.
 */
export interface VendorConfigEntry {
  vendorName: string;
  configFilePath: string;
}

/**
 * Service singleton pour gérer les configurations API par vendor.
 * Charge le fichier de configuration principal (API_LIB) et
 * permet d'interroger les vendorNames et leurs chemins.
 */
export class ApiConfigService {
  private static instance: ApiConfigService;
  private entries: VendorConfigEntry[] = [];

  /**
   * Constructeur privé, use getInstance() pour obtenir l'instance.
   * @param configFilePath Chemin vers le fichier de configuration (apiLib.json)
   */
  private constructor(private configFilePath: string) {}

  /**
   * Retourne l'instance unique, en initialisant les entrées si nécessaire.
   * @param configFilePath Chemin vers apiLib.json
   */
  public static async getInstance(configFilePath: string): Promise<ApiConfigService> {
    if (!ApiConfigService.instance) {
      const svc = new ApiConfigService(configFilePath);
      await svc.load();
      ApiConfigService.instance = svc;
    }
    return ApiConfigService.instance;
  }

  /**
   * Charge et parse le fichier JSON de configuration pour peupler les entries.
   * @throws {Error} si le format JSON est invalide ou l'accès au fichier échoue.
   */
  private async load(): Promise<void> {
    const loader = FileLoader.getInstance();
    const metadata: FileMetadata = await loader.load(this.configFilePath);
    const data = metadata.content;
    if (!data || !Array.isArray((data as any).vendors)) {
      throw new Error(`Format invalide dans ${this.configFilePath}: la propriété 'vendors' est manquante ou mal formée.`);
    }
    this.entries = (data as any).vendors.map((entry: any) => ({
      vendorName: entry.vendorName,
      configFilePath: entry.configFilePath,
    }));
  }

  /**
   * Retourne le chemin de configuration associé à un vendorName.
   * @param vendorName Nom du vendor
   * @returns Le chemin de config, ou undefined si le vendorName n'existe pas.
   */
  public getConfigPath(vendorName: string): string | undefined {
    const key = vendorName.toLowerCase();
    const found = this.entries.find(e => e.vendorName.toLowerCase() === key);
    return found?.configFilePath;
  }

  /**
   * Retourne la liste de tous les vendorName disponibles.
   * @returns Tableau de chaînes de caractères
   */
  public getAllVendorNames(): string[] {
    return this.entries
      .map(e => e.vendorName)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }
}