import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader } from '../../core/utils/FileLoader';

describe('FileLoader cache', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const testFile = 'test.json';
  const otherFile = 'other.json';

  let loader: FileLoader;

  beforeAll(async () => {
    // Create fixtures directory and test files
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.writeFile(
      path.join(fixturesDir, testFile),
      JSON.stringify({ foo: 'bar' }),
      'utf-8'
    );
    await fs.writeFile(
      path.join(fixturesDir, otherFile),
      JSON.stringify({ foo: 'baz' }),
      'utf-8'
    );
  });

  beforeEach(() => {
    loader = FileLoader.getInstance(fixturesDir);
    loader.clearCache();
  });

  it('should cache results and clearCache empties it', async () => {
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');
    // First load: cache miss
    await loader.load(testFile);
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Second load: cache hit, no new stat
    await loader.load(testFile);
    expect(spyStat).toHaveBeenCalledTimes(1);

    // Clear cache
    loader.clearCache();

    // Third load: cache miss again
    await loader.load(testFile);
    expect(spyStat).toHaveBeenCalledTimes(2);

    spyStat.mockRestore();
  });

  it('should invalidate only the specified entry', async () => {
    // Preload both files
    await loader.load(testFile);
    await loader.load(otherFile);
    // Spy on stat only after preloads to count calls post-invalidation
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');

    // Invalidate only testFile
    loader.invalidate(testFile);

    // testFile: cache miss after invalidation
    await loader.load(testFile);
    // otherFile: still cached
    await loader.load(otherFile);

    expect(spyStat).toHaveBeenCalledTimes(1);
    spyStat.mockRestore();
  });
});