import * as path from 'path';
import { promises as fs } from 'fs';
import { AuditService } from '../../core/utils/AuditService';
import { FileLoader } from '../../core/utils/FileLoader';

describe('FileLoader Audit Coverage', () => {
  const fixtures = path.resolve(__dirname, 'fixtures');
  const validFile = 'audit_valid.json';
  const invalidFile = 'audit_invalid.json';
  let loader: FileLoader;

  beforeAll(async () => {
    // Prépare le répertoire fixtures avec un JSON valide
    await fs.mkdir(fixtures, { recursive: true });
    await fs.writeFile(path.join(fixtures, validFile), JSON.stringify({ hello: 'world' }), 'utf-8');
  });

  beforeEach(() => {
    // Réinitialise les singletons pour chaque test
    (AuditService as any).instance = undefined;
    (FileLoader as any).instance = undefined;

    loader = FileLoader.getInstance(fixtures);
    loader.clearCache();
  });

  it('should emit FILE_LOAD_START and FILE_LOADED on successful load', async () => {
    const spyLog = jest.spyOn(AuditService.getInstance(), 'log');

    await loader.load(validFile);

    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_START',
        resource: validFile,
        status: 'INIT',
      }),
    );
    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOADED',
        resource: validFile,
        status: 'SUCCESS',
      }),
    );

    spyLog.mockRestore();
  });

  it('should emit FILE_LOAD_START and FILE_LOAD_ERROR on failed load', async () => {
    const spyLog = jest.spyOn(AuditService.getInstance(), 'log');

    await expect(loader.load(invalidFile)).rejects.toThrow();

    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_START',
        resource: invalidFile,
        status: 'INIT',
      }),
    );
    expect(spyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'FileLoader',
        event: 'FILE_LOAD_ERROR',
        resource: invalidFile,
        status: 'FAILURE',
      }),
    );

    spyLog.mockRestore();
  });
});
