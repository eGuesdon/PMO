import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader, FileMetadata } from '../../core/utils/FileLoader';

describe('FileLoader TTL + fingerprint', () => {
  const fixtures = path.resolve(__dirname, 'fixtures');
  const file = 'foo.txt';
  let loader: FileLoader;

  beforeAll(async () => {
    await fs.mkdir(fixtures, { recursive: true });
    await fs.writeFile(path.join(fixtures, file), 'initial', 'utf-8');
  });

  beforeEach(() => {
    loader = FileLoader.getInstance(fixtures);
    loader.clearCache();
  });

  it('rafraîchit le cache si le contenu change avant expiration', async () => {
    const m1 = await loader.load(file);
    // on modifie le fichier sans attendre 5 min
    await fs.writeFile(path.join(fixtures, file), 'changed', 'utf-8');
    const m2 = await loader.load(file);
    expect(m2.fingerprint).not.toEqual(m1.fingerprint);
  });

  it("réutilise le cache tant que le fichier n'a pas changé et avant TTL", async () => {
    const spyStat = jest.spyOn(require('fs/promises'), 'stat');
    await loader.load(file); // premier appel → I/O
    expect(spyStat).toHaveBeenCalledTimes(1);
    await loader.load(file); // contenu identique → cache hit
    expect(spyStat).toHaveBeenCalledTimes(1);
    spyStat.mockRestore();
  });
});
