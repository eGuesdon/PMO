import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader } from '../../core/utils/FileLoader';

describe('FileLoader TTL expiration and fingerprint reload', () => {
  const fixtures = path.resolve(__dirname, 'fixtures');
  const fileName = 'reload.txt';
  const absPath = path.join(fixtures, fileName);
  let loader: FileLoader;

  beforeAll(async () => {
    await fs.mkdir(fixtures, { recursive: true });
    await fs.writeFile(absPath, 'initial', 'utf-8');
  });

  beforeEach(() => {
    loader = FileLoader.getInstance(fixtures);
    loader.clearCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reload file after TTL even if content unchanged', async () => {
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');

    // Premier load → cache miss
    await loader.load(fileName);
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Deuxième load avant TTL → cache hit
    await loader.load(fileName);
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Avance de 5 minutes + 1 ms pour expirer le TTL
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Troisième load → TTL expiré, relance du stat
    await loader.load(fileName);
    expect(spyStat).toHaveBeenCalledTimes(2);

    spyStat.mockRestore();
  });

  it('should reload file when fingerprint changes before TTL', async () => {
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');

    // Premier load → cache miss
    await loader.load(fileName);
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Modification du fichier avant TTL
    await fs.writeFile(absPath, 'modified', 'utf-8');

    // Deuxième load → fingerprint changé, relance du stat
    await loader.load(fileName);
    expect(spyStat).toHaveBeenCalledTimes(2);

    spyStat.mockRestore();
  });
});
