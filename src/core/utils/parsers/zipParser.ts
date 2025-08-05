// src/core/utils/parsers/zipParser.ts
import { Readable } from 'stream';
import unzipper from 'unzipper';

export interface ZipEntry {
  path: string;
  type: 'File' | 'Directory';
  size: number;
  content: Buffer;
}

/**
 * Parcourt un flux ZIP et renvoie un AsyncIterable
 * d’entrées (fichiers/dossiers), avec leur contenu en Buffer.
 *
 * @param zipStream un Readable obtenue par loadAsStream()
 */
export async function* parseZIPStream(zipStream: Readable): AsyncIterable<ZipEntry> {
  // pipe le Readable HTTP/local dans unzipper
  const directory = zipStream.pipe(unzipper.Parse());

  for await (const entry of directory) {
    const { path: entryPath, type, size } = entry;
    if (type === 'Directory') {
      // on rejette le buffer pour un dossier
      yield { path: entryPath, type, size, content: Buffer.alloc(0) };
      entry.autodrain();
    } else {
      // on lit tout le contenu du fichier
      const chunks: Buffer[] = [];
      for await (const chunk of entry as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      yield {
        path: entryPath,
        type,
        size,
        content: Buffer.concat(chunks),
      };
    }
  }
}
