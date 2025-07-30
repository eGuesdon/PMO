import { parse } from 'csv-parse/sync';

export function parseCSV(raw: string): any {
  try {
    return parse(raw, {
      columns: true,
      skip_empty_lines: true,
    });
  } catch (error) {
    console.error('❌ Erreur de parsing CSV', error);
    return raw;
  }
}
