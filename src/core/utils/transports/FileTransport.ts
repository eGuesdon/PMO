import { Readable } from 'stream';

/**
 * FileReadResult représente le résultat de la lecture complète d'un fichier.
 *
 * @template T Type du contenu retourné (string ou Buffer).
 */
export interface FileReadResult<T = string> {
  /** Contenu du fichier en mémoire. */
  data: T;
  /** Métadonnées du fichier lues depuis la source. */
  metadata: {
    /** Date de création du fichier (ou approximation). */
    createdAt: Date;
    /** Date de dernière modification du fichier. */
    updatedAt: Date;
  };
}

/**
 * FileTransport définit l'interface pour lire des fichiers
 * depuis différentes sources (local, HTTP, S3, etc.).
 */
export interface FileTransport {
  /**
   * Lit entièrement le fichier (ou URL) spécifié et retourne
   * son contenu et ses métadonnées.
   *
   * @param pathOrUrl Chemin ou URL du fichier à lire.
   * @returns Promise résolue par le contenu et les métadonnées.
   */
  readAll(pathOrUrl: string): Promise<FileReadResult>;

  /**
   * Renvoie un Readable pour lire le fichier (ou URL) en flux.
   *
   * @param pathOrUrl Chemin ou URL du fichier à lire.
   * @returns Readable stream de contenu en chunk.
   */
  readStream(pathOrUrl: string): Promise<Readable>;
}
