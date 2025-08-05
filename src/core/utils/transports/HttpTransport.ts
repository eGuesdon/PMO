import { Readable } from 'stream';
import type { FileTransport, FileReadResult } from './FileTransport';

/**
 * Transport HTTP pour la lecture de fichiers distants en GET.
 * HTTP transport for reading remote files via GET.
 */
export class HttpTransport implements FileTransport {
  /**
   * Lit entièrement le contenu d'une URL et retourne les données et métadonnées.
   * Read full content of a remote URL and return data with metadata.
   *
   * @param url L'URL du fichier à lire.
   */
  public async readAll(url: string): Promise<FileReadResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for URL ${url}`);
    }
    const data = await response.text();
    const lm = response.headers.get('last-modified');
    const modifiedAt = lm ? new Date(lm) : new Date();
    // Pas de création fiable pour HTTP, on utilise la date de modification comme date de création.
    return {
      data,
      metadata: {
        createdAt: modifiedAt,
        updatedAt: modifiedAt,
      },
    };
  }

  /**
   * Retourne un Readable pour lire le contenu binaire d'une URL en streaming.
   * Uses Node.js native conversion from Web ReadableStream to Node Readable.
   *
   * @param url L'URL du fichier à lire.
   * @throws Error if the HTTP response is not ok or body is empty.
   */
  public async readStream(url: string): Promise<Readable> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Node.js FileLoader' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for URL ${url}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/application\/zip/.test(contentType)) {
      console.warn(`Warning: content-type "${contentType}" for URL ${url}, expected application/zip`);
    }

    const body = response.body;
    if (!body) {
      throw new Error(`Empty response body for URL ${url}`);
    }
    // Node 18+: convert Web ReadableStream<Uint8Array> to Node.js Readable
    // Using Readable.fromWeb, ensure global support
    return (Readable as any).fromWeb(body as any);
  }
}
