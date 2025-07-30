import { parseJSON } from './jsonParser';
import { parseXML } from './xmlParser';
import { parseCSV } from './csvParser';

type ParserFn = (raw: string) => any;

const parsers: Record<string, ParserFn> = {
  '.json': parseJSON,
  '.xml': parseXML,
  '.csv': parseCSV,
};

export function parseContent(extension: string, raw: string): any {
  const parser = parsers[extension.toLowerCase()];
  if (!parser) return raw;

  try {
    return parser(raw);
  } catch (error) {
    console.error(`❌ Erreur lors du parsing du fichier (${extension})`, error);
    return raw;
  }
}
