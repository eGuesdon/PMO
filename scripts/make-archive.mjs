import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import fg from 'fast-glob';

const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15); // YYYYMMDDHHMMSS
const outName = `snapshot-${ts}.zip`;

// Exclusions par défaut
const defaultExcludes = ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.vscode/**', '*.log', '*.tmp', '.DS_Store', '*.zip', '.env', '.env.*'];

// Charger .archiveignore (optionnel)
const ignoreFile = '.archiveignore';
let extraExcludes = [];
if (fs.existsSync(ignoreFile)) {
  extraExcludes = fs
    .readFileSync(ignoreFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const excludes = [...defaultExcludes, ...extraExcludes];

const output = fs.createWriteStream(outName);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✅ Créé ${outName} (${archive.pointer()} octets)`);
});
archive.on('warning', (err) => {
  if (err.code !== 'ENOENT') throw err;
});
archive.on('error', (err) => {
  throw err;
});
archive.pipe(output);

const entries = await fg(['**/*', '!**/*.zip'], {
  dot: true, // inclure fichiers commençant par .
  ignore: excludes,
  onlyFiles: false, // inclure dossiers
  followSymbolicLinks: false,
});

for (const entry of entries) {
  const full = path.resolve(entry);
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    archive.append(null, { name: entry.endsWith('/') ? entry : entry + '/' });
  } else {
    archive.file(full, { name: entry });
  }
}

await archive.finalize();
