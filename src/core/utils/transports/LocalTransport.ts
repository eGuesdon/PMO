/**
 * Transport local pour la lecture de fichiers sur disque.
 * Local transport for reading files from the filesystem.
 */

import { promises as fs, createReadStream, Stats } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import type { FileTransport, FileReadResult } from './FileTransport';

/**
 * LocalTransport permet de lire des fichiers
 * depuis le disque local, en mémoire ou en streaming.
 */
export class LocalTransport implements FileTransport {
  /**
   * @param baseDir Répertoire de base pour les chemins relatifs.
   */
  constructor(private baseDir: string) {}

  /**
   * Lit entièrement le fichier spécifié et retourne
   * son contenu ainsi que ses métadonnées.
   *
   * @param pathOrUrl Chemin relatif ou absolu vers le fichier.
   */
  public async readAll(pathOrUrl: string): Promise<FileReadResult> {
    const absPath = path.isAbsolute(pathOrUrl) ? pathOrUrl : path.resolve(this.baseDir, pathOrUrl);

    const stats: Stats = await fs.stat(absPath);
    const data: string = await fs.readFile(absPath, 'utf-8');
    return {
      data,
      metadata: {
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      },
    };
  }

  /**
   * Retourne un Readable pour lire le fichier
   * en flux chunk par chunk.
   *
   * @param pathOrUrl Chemin relatif ou absolu vers le fichier.
   */
  public async readStream(pathOrUrl: string): Promise<Readable> {
    const absPath = path.isAbsolute(pathOrUrl) ? pathOrUrl : path.resolve(this.baseDir, pathOrUrl);

    return createReadStream(absPath, { encoding: 'utf-8' });
  }
}
