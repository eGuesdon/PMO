// src/index.ts
import { FileLoader } from './core/utils/FileLoader';

async function main() {
  // Récupère l’instance singleton (baseDir = process.cwd())
  const loader = FileLoader.getInstance();

  try {
    // Charge le fichier relatif à la racine du projet
    const metadata = await loader.load('config/api/apiLib.json');

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
}

main();