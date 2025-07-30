export function parseJSON(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('❌ Erreur de parsing JSON', error);
    return raw;
  }
}
