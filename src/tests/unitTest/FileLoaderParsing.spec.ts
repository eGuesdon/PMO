import * as path from 'path';
import { promises as fs } from 'fs';
import { FileLoader } from '../../core/utils/FileLoader';

describe('FileLoader parsing errors', () => {
  const fixtures = path.resolve(__dirname, 'fixtures');
  const badJson = 'bad.json';
  const badXml  = 'bad.xml';
  const badCsv  = 'bad.csv';
  let loader: FileLoader;

  beforeAll(async () => {
    await fs.mkdir(fixtures, { recursive: true });
    await fs.writeFile(path.join(fixtures, badJson), '{ not: valid', 'utf-8');
    await fs.writeFile(path.join(fixtures, badXml), '<tag><unclosed>', 'utf-8');
    await fs.writeFile(path.join(fixtures, badCsv), 'a,b\n1', 'utf-8');
  });

  beforeEach(() => {
    loader = FileLoader.getInstance(fixtures);
    loader.clearCache();
  });

  it('should return raw JSON string on invalid JSON', async () => {
    const result = await loader.load(badJson);
    expect(result.content).toBe('{ not: valid');
  });

  it('should return raw CSV string on invalid CSV', async () => {
    const result = await loader.load(badCsv);
    expect(result.content).toBe('a,b\n1');
  });

  it('should return parsed object or raw XML string on invalid XML', async () => {
    const result = await loader.load(badXml);
    expect(
      result.content === '<tag><unclosed>' ||
      (typeof result.content === 'object' &&
       result.content.tag && result.content.tag.unclosed === '')
    ).toBe(true);
  });
});
