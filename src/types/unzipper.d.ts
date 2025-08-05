// src/@types/unzipper/index.d.ts
declare module 'unzipper' {
  import { Transform, Writable } from 'stream';

  export function Parse(): Transform;
  export function Extract(opts: { path: string }): Writable;

  export namespace Open {
    function buffer(data: Buffer): Promise<OpenDirectory>;
  }

  export interface OpenDirectory {
    files: Array<{
      path: string;
      type: 'Directory' | 'File';
      compressedSize: number;
      buffer(): Promise<Buffer>;
    }>;
  }
}
