import { Parser as CsvStreamParser } from 'csv-parse';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'stream';

/**
 * Parse JSON ligne par ligne (newline-delimited JSON) ou tableau en flux.
 */
export function parseJSONStream(stream: Readable): AsyncIterable<any> {
  // Ex. avec stream-json
  const pipeline = stream.pipe(streamArray());
  // pipeline est un readable qui émet {key, value} objets
  return pipeline[Symbol.asyncIterator]();
}

/**
 * Parse CSV en flux, émettant chaque enregistrement en objet.
 */
export async function* parseCSVStream(stream: Readable): AsyncIterable<Record<string, any>> {
  const parser = stream.pipe(new CsvStreamParser({ columns: true, skip_empty_lines: true }));
  for await (const record of parser) {
    yield record;
  }
}

/**
 * Parse XML en flux (SAX-like), émettant des événements.
 */
export function parseXMLStream(stream: Readable): AsyncIterable<{ tag: string; attrs: any; text: string }> {
  // Exemple avec un parser SAX, p.ex. node-expat ou sax
  // On créerait un AsyncIterable qui wrappe les événements 'startElement', 'text', 'endElement'
  throw new Error('À implémenter : utilisation d’un parser SAX pour XML');
}
