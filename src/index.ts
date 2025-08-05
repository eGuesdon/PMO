// src/index.ts
import { FileLoader } from './core/utils/FileLoader';
import { parseZIPStream } from './core/utils/parsers/zipParser';

async function main() {
  // Récupère l’instance singleton (baseDir = process.cwd())
  const loader = FileLoader.getInstance();

  try {
    // Charge le fichier relatif à la racine du projet
    const metadata = await loader.load('src/config/api/AtlassianApiLib.json');

    console.log('📄 Fichier chargé :', metadata.name);
    console.log('📁 Chemin absolu :', metadata.path);
    console.log('🔣 Extension       :', metadata.extension);
    console.log('🕒 Créé le        :', metadata.createdAt.toISOString());
    console.log('🕑 Modifié le     :', metadata.updatedAt.toISOString());
    console.log('🔑 Fingerprint    :', metadata.fingerprint);
    console.log('🗂 Contenu parsé   :', metadata.content);
  } catch (err: any) {
    console.error('⚠️  Impossible de charger le fichier :', err.message);
  }

  await zipDemo();
}

async function streamDemo() {
  const loader = FileLoader.getInstance();
  const fileToStream = 'src/config/api/AtlassianApiLib.json';

  console.log(`🚀 Début du streaming de ${fileToStream}`);
  try {
    const stream = await loader.loadAsStream(fileToStream);
    let aggregated = '';
    for await (const chunk of stream) {
      aggregated += chunk;
      // Ici, on affiche un indicateur simple
      process.stdout.write('.');
    }
    console.log('\n✅ Streaming terminé, taille totale :', aggregated.length, 'octets');
    console.log('📄 Contenu complet :\n', aggregated);
  } catch (err: any) {
    console.error('⚠️ Erreur en streaming :', err.message);
  }
}

async function zipDemo() {
  const loader = FileLoader.getInstance();
  // ZIP standard GitHub d’un repo public
  const zipUrl = 'https://github.com/eGuesdon/PMO/archive/refs/heads/main.zip';

  console.log(`🚀 Streaming et décompression de ${zipUrl}`);
  const zipStream = await loader.loadAsStream(zipUrl);

  for await (const entry of parseZIPStream(zipStream)) {
    console.log(`📄 Entrée: ${entry.path} (${entry.type}), taille: ${entry.size} octets`);
    // Si vous voulez lire le contenu :
    console.log('   → contenu:', entry.content.toString('utf-8').slice(0, 100), '…');
  }
}

main().catch((err) => {
  console.error('🔥 Erreur inattendue dans main :', err);
  process.exit(1);
});
// streamDemo();
// zipDemo();
