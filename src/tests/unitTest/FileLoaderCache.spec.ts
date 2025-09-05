import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader } from '../../core/utils/FileLoader'; // Import nommé

describe('FileLoader cache', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const testFile = 'test.json';
  const otherFile = 'other.json';

  let loader: FileLoader;

  beforeAll(async () => {
    // Create fixtures directory and test files
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.writeFile(path.join(fixturesDir, testFile), JSON.stringify({ foo: 'bar' }), 'utf-8');
    await fs.writeFile(path.join(fixturesDir, otherFile), JSON.stringify({ foo: 'baz' }), 'utf-8');
  });

  beforeEach(() => {
    if (typeof (FileLoader as any).resetInstance === 'function') {
      (FileLoader as any).resetInstance();
    } else {
      (FileLoader as any).instance = undefined;
    }
    loader = FileLoader.getInstance(fixturesDir);
    loader.clearCache();
  });

  it('should cache results and clearCache empties it', async () => {
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');
    // First load: cache miss
    await loader.load(path.join(fixturesDir, testFile));
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Second load: cache hit, no new stat
    await loader.load(path.join(fixturesDir, testFile));
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Clear cache
    loader.clearCache();

    // Third load: cache miss again
    await loader.load(path.join(fixturesDir, testFile));
    expect(spyStat).toHaveBeenCalledTimes(2);

    spyStat.mockRestore();
  });

  it('should invalidate only the specified entry', async () => {
    // Preload both files
    await loader.load(path.join(fixturesDir, testFile));
    await loader.load(path.join(fixturesDir, otherFile));
    // Spy on stat only after preloads to count calls post-invalidation
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');

    // Invalidate only testFile
    loader.invalidate(path.join(fixturesDir, testFile));

    // testFile: cache miss after invalidation
    await loader.load(path.join(fixturesDir, testFile));
    // otherFile: still cached
    await loader.load(path.join(fixturesDir, otherFile));

    expect(spyStat).toHaveBeenCalledTimes(1);
    spyStat.mockRestore();
  });
});
