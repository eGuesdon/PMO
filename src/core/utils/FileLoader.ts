import * as fsp from 'fs/promises';
import type { Stats } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { parseContent } from './parsers';

/**
 * Erreur générale du FileLoader, pour les problèmes d'accès ou de lecture.
 */
export class FileLoaderError extends Error {
  public readonly cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'FileLoaderError';
    this.cause = cause;
  }
}

/**
 * Erreur spécifique au parsing de contenu (JSON, XML, CSV).
 */
export class FileParsingError extends FileLoaderError {
  constructor(extension: string, cause: Error) {
    super(`Erreur de parsing pour l'extension ${extension}`, cause);
    this.name = 'FileParsingError';
  }
}

export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
  fingerprint: string;
  content?: any;
}

/**
 * Charge un fichier et retourne ses métadonnées et contenu (si parsable).
 * Load a file and return its metadata and content (if parsable).
 */
export class FileLoader {
  private baseDir: string;
  private cache: Map<string, FileMetadata> = new Map();
  private static instance: FileLoader;

  /**
   * Initialise le FileLoader.
   * @param baseDir Répertoire de base pour les chemins relatifs (défaut: process.cwd()).
   *               Base directory for resolving relative paths (default: process.cwd()).
   */
  private constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * Retourne l'instance unique de FileLoader.
   * Returns the singleton instance of FileLoader.
   * @param baseDir Répertoire de base pour les chemins relatifs (défaut: process.cwd()).
   */
  public static getInstance(baseDir?: string): FileLoader {
    if (!FileLoader.instance) {
      FileLoader.instance = new FileLoader(baseDir ?? process.cwd());
    }
    return FileLoader.instance;
  }

  /**
   * Charge un fichier donné de façon asynchrone.
   * @param filePath Chemin relatif ou absolu du fichier.
   *                 Relative or absolute path to the file.
   * @returns Promise<FileMetadata> Métadonnées du fichier et contenu parsé si applicable.
   *                               File metadata and parsed content if applicable.
   * @throws En cas d'erreur de lecture ou d'accès au fichier.
   * @throws If there is an error reading or accessing the file.
   */
  public async load(filePath: string): Promise<FileMetadata> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.baseDir, filePath);

    let raw: string;
    let stats: Stats;
    try {
      stats = await fsp.stat(absolutePath);
      raw = await fsp.readFile(absolutePath, 'utf-8');
    } catch (err: any) {
      // Erreur d'accès ou de lecture
      throw new FileLoaderError(`Impossible d’accéder au fichier : ${absolutePath}`, err);
    }

    // Calcul de l’empreinte SHA-256
    const hash = createHash('sha256').update(raw).digest('hex');

    // Vérification du cache par empreinte
    const cached = this.cache.get(absolutePath);
    if (cached && cached.fingerprint === hash) {
      return cached;
    }

    // Parsing si extension pris en charge
    const ext = path.extname(absolutePath).toLowerCase();
    let content: any;
    if (['.json', '.xml', '.csv'].includes(ext)) {
      try {
        content = parseContent(ext, raw);
      } catch (err: any) {
        // Erreur de parsing
        throw new FileParsingError(ext, err);
      }
    }

    // Construction des métadonnées puis mise en cache
    const metadata: FileMetadata = {
      path: absolutePath,
      name: path.basename(absolutePath),
      extension: ext,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
      fingerprint: hash,
      content,
    };

    this.cache.set(absolutePath, metadata);
    return metadata;
  }
}
