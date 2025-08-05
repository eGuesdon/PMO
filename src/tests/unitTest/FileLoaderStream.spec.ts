import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader } from '../../core/utils/FileLoader';
import { AuditService } from '../../core/utils/AuditService';

describe('FileLoader Streaming', () => {
  const fixtures = path.resolve(__dirname, 'fixtures');
  const streamFile = 'stream.txt';
  const filePath = path.join(fixtures, streamFile);
  let loader: FileLoader;

  beforeAll(async () => {
    // Prepare a large fixture: 100 lines
    await fs.mkdir(fixtures, { recursive: true });
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join('\n') + '\n';
    await fs.writeFile(filePath, lines, 'utf-8');
  });

  beforeEach(() => {
    // Reset singletons
    (AuditService as any).instance = undefined;
    (FileLoader as any).instance = undefined;
    loader = FileLoader.getInstance(fixtures);
    loader.clearCache();
  });

  it('should stream file content chunk by chunk', async () => {
    const stream = await loader.loadAsStream(streamFile);
    let collected = '';
    for await (const chunk of stream) {
      collected += chunk;
    }
    const expected = await fs.readFile(filePath, 'utf-8');
    expect(collected).toBe(expected);
  });

  it('should emit stream audit events on success', async () => {
    const spyLog = jest.spyOn(AuditService.getInstance(), 'log');
    const stream = await loader.loadAsStream(streamFile);
    for await (const _ of stream) {
    }
    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_START',
        resource: streamFile,
        status: 'INIT',
      }),
    );
    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_END',
        resource: streamFile,
        status: 'SUCCESS',
      }),
    );
    expect(spyLog).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'FILE_LOAD_STREAM_ERROR' }));
    spyLog.mockRestore();
  });

  it('should emit stream audit error on missing file', async () => {
    const missing = 'nope.txt';
    const spyLog = jest.spyOn(AuditService.getInstance(), 'log');
    await expect(async () => {
      const s = await loader.loadAsStream(missing);
      for await (const _ of s) {
      }
    }).rejects.toThrow();
    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_START',
        resource: missing,
        status: 'INIT',
      }),
    );
    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_STREAM_ERROR',
        resource: missing,
        status: 'FAILURE',
      }),
    );
    spyLog.mockRestore();
  });
});
