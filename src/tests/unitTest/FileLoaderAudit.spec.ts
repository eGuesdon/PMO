import * as path from 'path';
import { promises as fs } from 'fs';
import { AuditService } from '../../core/utils/AuditService';
import { FileLoader } from '../../core/utils/FileLoader';

describe('Intégration Audit FileLoader', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const jsonFile = 'test.json';
  const missingFile = 'missing.json';
  let loader: FileLoader;

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.writeFile(path.join(fixturesDir, jsonFile), JSON.stringify({ foo: 'bar' }), 'utf-8');
  });

  beforeEach(() => {
    // Réinitialise les singletons pour chaque test
    (AuditService as any).instance = undefined;
    (FileLoader as any).instance = undefined;

    loader = FileLoader.getInstance(fixturesDir);
    loader.clearCache();
  });

  it('doit émettre FILE_LOAD_START et FILE_LOADED en cas de succès', async () => {
    const spyLog = jest.spyOn(AuditService.getInstance(), 'log');
    await loader.load(jsonFile);

    expect(spyLog).toHaveBeenCalledWith(expect.objectContaining({ event: 'FILE_LOAD_START', resource: jsonFile, status: 'INIT' }));
    expect(spyLog).toHaveBeenCalledWith(expect.objectContaining({ event: 'FILE_LOADED', resource: jsonFile, status: 'SUCCESS' }));

    spyLog.mockRestore();
  });

  it("doit émettre FILE_LOAD_ERROR en cas d'échec", async () => {
    const spyLog = jest.spyOn(AuditService.getInstance(), 'log');

    await expect(loader.load(missingFile)).rejects.toThrow();

    expect(spyLog).toHaveBeenCalledWith(expect.objectContaining({ event: 'FILE_LOAD_ERROR', resource: missingFile, status: 'FAILURE' }));

    spyLog.mockRestore();
  });
});
