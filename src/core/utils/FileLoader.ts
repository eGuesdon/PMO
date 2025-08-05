import * as fsp from 'fs/promises';
import { createReadStream, Stats } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { Readable } from 'stream';

import { parseContent } from './parsers';
import { AuditService, FileAuditTransport } from './AuditService';
import { SimpleLRUCache } from './SimpleLRUCache';
import type { FileTransport } from './transports/FileTransport';
import { LocalTransport } from './transports/LocalTransport';
import { HttpTransport } from './transports/HttpTransport';
/**
 * Métadonnées retournées par FileLoader.
 */
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
 * Entrée de cache en mémoire avec TTL et fingerprint.
 */
interface CacheEntry {
  metadata: FileMetadata;
  expiresAt: number;
}

/**
 * Chargement de fichier avec audit, cache TTL+empreinte et singleton.
 */
export class FileLoader {
  private static instance: FileLoader;
  /** Liste des transports pour lecture locale ou distante. */
  private transports: FileTransport[];
  /**
   * Cache LRU des entrées avec TTL et fingerprint.
   * LRU cache of entries with TTL and fingerprint.
   */
  private cache: SimpleLRUCache<string, CacheEntry>;
  private readonly ttlMs = 5 * 60 * 1000; // 5 min

  private constructor(
    transports: FileTransport[],
    private baseDir: string = process.cwd(),
  ) {
    // Initialise un cache LRU à 100 entrées, sans hook d'éviction
    this.cache = new SimpleLRUCache<string, CacheEntry>(100);
    this.transports = transports;
  }

  /** Récupère l’instance unique (et configure audit une seule fois). */
  public static getInstance(baseDir?: string, transports?: FileTransport[]): FileLoader {
    if (!FileLoader.instance) {
      const tx = transports ?? [new LocalTransport(baseDir ?? process.cwd())];
      FileLoader.instance = new FileLoader(tx, baseDir ?? process.cwd());
      // Première instanciation : config audit
      const auditLogPath = path.resolve(process.cwd(), 'logs/audit.log');
      const transportAudit = new FileAuditTransport(auditLogPath);
      AuditService.getInstance([transportAudit]);
    }
    return FileLoader.instance;
  }

  /** Vide intégralement le cache. */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalide l’entrée de cache d’un fichier.
   * @param filePath chemin relatif ou absolu
   */
  public invalidate(filePath: string): void {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(this.baseDir, filePath);
    this.cache.delete(abs);
  }

  /**
   * Charge un fichier avec audit, cache TTL+empreinte.
   * @throws FileLoaderError en cas d’échec I/O
   * @throws FileParsingError si parsing JSON/XML/CSV échoue
   */
  public async load(filePath: string): Promise<FileMetadata> {
    // Audit : début de chargement
    AuditService.getInstance().log({
      actor: 'FileLoader',
      event: 'FILE_LOAD_START',
      resource: filePath,
      status: 'INIT',
    });

    const abs = filePath;
    const isRemote = /^https?:\/\//.test(filePath) || /^s3:\/\//.test(filePath);

    // 1) Vérification cache avant I/O (TTL uniquement)
    const now = Date.now();
    const entry = this.cache.get(abs);
    if (entry && entry.expiresAt > now) {
      // 2) Pour les TTL still valid, on doit vérifier si le fingerprint n’a pas changé
      //    => on relit juste le hash (optimisable en cache partiel)
      const rawCheck = await fsp.readFile(abs, 'utf-8');
      const hashCheck = createHash('sha256').update(rawCheck).digest('hex');
      if (entry.metadata.fingerprint === hashCheck) {
        return entry.metadata;
      }
      // sinon, on poursuit pour mettre à jour cache et lecture complète
    }

    // 3) Lecture via transport
    let stats, raw: string;
    try {
      if (isRemote) {
        const result = await this.transports[0].readAll(filePath);
        raw = result.data;
        stats = { birthtime: result.metadata.createdAt, mtime: result.metadata.updatedAt } as Stats;
      } else {
        stats = await fsp.stat(path.resolve(this.baseDir, filePath));
        raw = await fsp.readFile(path.resolve(this.baseDir, filePath), 'utf-8');
      }
    } catch (err: any) {
      // Audit : erreur de lecture
      AuditService.getInstance().log({
        actor: 'FileLoader',
        event: 'FILE_LOAD_ERROR',
        resource: filePath,
        status: 'FAILURE',
        details: err.message,
      });
      throw err;
    }

    // 4) Calcul fingerprint définitif
    const fingerprint = createHash('sha256').update(raw).digest('hex');

    // 5) Parsing si extension supportée
    const ext = path.extname(abs).toLowerCase();
    let content: any;
    if (['.json', '.xml', '.csv'].includes(ext)) {
      try {
        content = parseContent(ext, raw);
      } catch (err: any) {
        throw err;
      }
    }

    // 6) Assemblage métadonnées
    const metadata: FileMetadata = {
      path: abs,
      name: path.basename(abs),
      extension: ext,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
      fingerprint,
      content,
    };

    // Audit : chargement réussi
    AuditService.getInstance().log({
      actor: 'FileLoader',
      event: 'FILE_LOADED',
      resource: filePath,
      status: 'SUCCESS',
      details: { fingerprint },
    });

    // 7) Insertion en cache (TTL + fingerprint)
    this.cache.set(abs, {
      metadata,
      expiresAt: Date.now() + this.ttlMs,
    });

    return metadata;
  }

  /**
   * Retourne un Readable Node.js pour lire le fichier
   * en flux, chunk par chunk (UTF-8).
   *
   * @param filePath Chemin relatif ou absolu du fichier.
   * @returns Readable, à utiliser avec `for await (const chunk of …)`.
   */
  public async loadAsStream(filePath: string): Promise<Readable> {
    const isRemote = filePath.startsWith('http://') || filePath.startsWith('https://');

    try {
      AuditService.getInstance().log({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_START',
        resource: filePath,
        status: 'INIT',
      });

      let stream: Readable;
      if (isRemote) {
        // pour les URLs, on délègue au transport HTTP
        const transport = new HttpTransport();
        stream = await transport.readStream(filePath);
      } else {
        // pour les fichiers locaux, on lit en stream
        const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(this.baseDir, filePath);
        stream = createReadStream(absolute);
      }

      AuditService.getInstance().log({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_END',
        resource: filePath,
        status: 'SUCCESS',
      });
      return stream;
    } catch (err: any) {
      AuditService.getInstance().log({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_ERROR',
        resource: filePath,
        status: 'FAILURE',
        details: err.message,
      });
      throw err;
    }
  }
}
