import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { parseContent } from './parsers';

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

  /**
   * Initialise le FileLoader.
   * @param baseDir Répertoire de base pour les chemins relatifs (défaut: process.cwd()).
   *               Base directory for resolving relative paths (default: process.cwd()).
   */
  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
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

    const stats = await fs.stat(absolutePath);
    const raw = await fs.readFile(absolutePath, 'utf-8');
    const ext = path.extname(absolutePath);

    let content: any;
    if (['.json', '.xml', '.csv'].includes(ext.toLowerCase())) {
      content = parseContent(ext, raw);
    }
    // TODO: gérer images, vidéos, audio (dimensions, durée) avec libs externes
    // TODO: handle images, video, audio (dimensions, duration) with external libraries

    const hash = createHash('sha256').update(raw).digest('hex');
    return {
      path: absolutePath,
      name: path.basename(absolutePath),
      extension: ext,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
      fingerprint: hash,
      content,
    };
  }
}
