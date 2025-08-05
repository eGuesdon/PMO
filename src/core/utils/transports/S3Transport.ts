/**
 * Transport S3 pour la lecture de fichiers depuis un bucket AWS S3.
 * S3 transport for reading files from an AWS S3 bucket.
 */

import { S3Client, GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { Readable, PassThrough } from 'stream';
import type { FileTransport, FileReadResult } from './FileTransport';

/**
 * S3Transport permet de lire des objets depuis un bucket S3,
 * en entier ou en streaming.
 */
export class S3Transport implements FileTransport {
  private client: S3Client;
  private bucket: string;

  /**
   * @param client  Instance de S3Client configurée (credentials, region, etc.).
   * @param bucket  Nom du bucket S3.
   */
  constructor(client: S3Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
  }

  /**
   * Lit entièrement l’objet S3 et retourne son contenu en string
   * ainsi que ses métadonnées (dates).
   *
   * @param key   Clé (chemin) de l’objet dans le bucket.
   */
  public async readAll(key: string): Promise<FileReadResult> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response: GetObjectCommandOutput = await this.client.send(cmd);

    // Convertir le Body en chaîne
    const stream = response.Body as Readable;
    const data = await this.streamToString(stream);

    // Obtenir la date de dernière modification depuis la réponse
    const updatedAt = response.LastModified ?? new Date();
    const createdAt = updatedAt; // S3 ne fournit pas la date de création, on utilise updatedAt

    return {
      data,
      metadata: {
        createdAt,
        updatedAt,
      },
    };
  }

  /**
   * Retourne un Readable pour lire l’objet S3 en flux chunk par chunk.
   *
   * @param key   Clé (chemin) de l’objet dans le bucket.
   */
  public async readStream(key: string): Promise<Readable> {
    const pass = new PassThrough();
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });

    this.client
      .send(cmd)
      .then((response) => {
        const body = response.Body as Readable;
        if (!body) {
          pass.destroy(new Error(`Empty S3 body for key ${key}`));
          return;
        }
        body.pipe(pass);
      })
      .catch((err: unknown) => pass.destroy(err as Error));

    return pass;
  }

  /**
   * Utility to convert a Readable stream into a string.
   *
   * @param stream  Readable stream to collect.
   */
  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', (err: Error) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
}
