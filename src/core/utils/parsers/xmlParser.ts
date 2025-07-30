import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser();

export function parseXML(raw: string): any {
  try {
    return parser.parse(raw);
  } catch (error) {
    console.error('❌ Erreur de parsing XML', error);
    return raw;
  }
}
