// src/types/unzipper.d.ts
declare module 'unzipper' {
  import { Transform, Writable } from 'stream';
  const unzipper: {
    Parse(): Transform;
    Extract(opts: { path: string }): Writable;
    // Add other methods if needed
  };
  export default unzipper;
}
