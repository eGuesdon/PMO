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
 * Cette version lit d'abord tout le flux en mémoire, puis
 * ouvre l'archive via unzipper.Open.buffer pour en extraire
 * toutes les entrées.
 *
 * @param zipStream flux binaire du ZIP
 */
export async function* parseZIPStream(zipStream: Readable): AsyncIterable<ZipEntry> {
  // 1) Lire tout le flux en mémoire
  const chunks: Buffer[] = [];
  for await (const chunk of zipStream) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  // 2) Ouvrir l'archive depuis le Buffer
  const directory = await unzipper.Open.buffer(buffer);

  // 3) Parcourir les fichiers/dossiers
  for (const entry of directory.files) {
    const { path: entryPath, type, compressedSize: size } = entry;
    if (entry.type === 'Directory') {
      yield { path: entryPath, type, size, content: Buffer.alloc(0) };
    } else {
      const contentBuffer = await entry.buffer();
      yield {
        path: entryPath,
        type,
        size,
        content: contentBuffer,
      };
    }
  }
}
