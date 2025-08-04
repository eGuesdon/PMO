import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader, FileMetadata } from '../../core/utils/FileLoader';

describe('FileLoader', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const loader = FileLoader.getInstance(fixturesDir);
  const testJson = 'test.json';
  const testTxt = 'test.txt';

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.writeFile(path.join(fixturesDir, 'test.json'), JSON.stringify({ foo: 'bar' }), 'utf-8');
    await fs.writeFile(path.join(fixturesDir, 'test.txt'), 'hello world', 'utf-8');
  });

  it('charge un JSON et parse son contenu', async () => {
    const result: FileMetadata = await loader.load(testJson);
    expect(result.extension).toBe('.json');
    expect(result.content).toEqual({ foo: 'bar' });
    expect(typeof result.fingerprint).toBe('string');
    expect(result.name).toBe(testJson);
  });

  it('charge un fichier texte brut sans parsing', async () => {
    const result: FileMetadata = await loader.load(testTxt);
    expect(result.extension).toBe('.txt');
    expect(result.content).toBeUndefined();
    expect(result.name).toBe(testTxt);
  });

  it('lève une erreur si le fichier n’existe pas', async () => {
    await expect(loader.load('nonexistent.ext')).rejects.toThrow();
  });
});