import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import {
  type FileHandle,
  mkdir,
  open,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

// Les dossiers de rangement. Les photos de produits sont publiques (servies telles quelles
// sous /fichiers/produits/…), celles des colis sont privées (servies par une route protégée).
export type DossierFichiers = 'produits' | 'colis';

// L'adresse publique d'une photo de produit
export function urlPhotoProduit(fichier: string): string {
  return `/fichiers/${fichier}`;
}

// La consigne : la base garde le « ticket » (ex. produits/3f9c….webp), le disque garde le fichier.
// Pour passer plus tard à un stockage en ligne, seul ce fichier change.
@Injectable()
export class StockageService {
  readonly racine: string;

  constructor(config: ConfigService) {
    this.racine = resolve(config.get<string>('DOSSIER_FICHIERS', 'fichiers'));
  }

  // Le dossier réel d'une catégorie de fichiers (pour servir les photos publiques)
  dossier(nom: DossierFichiers): string {
    return resolve(this.racine, nom);
  }

  // Range le contenu sous un nom tiré au hasard : jamais le nom choisi par l'expéditeur,
  // pour que personne ne puisse écraser un fichier ni écrire ailleurs
  async enregistrer(
    dossier: DossierFichiers,
    contenu: Buffer,
    extension = 'webp',
  ): Promise<string> {
    const fichier = `${dossier}/${randomUUID()}.${extension}`;
    const chemin = this.chemin(fichier);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, contenu, { flag: 'wx' }); // wx : n'écrase jamais
    return fichier;
  }

  // Le fichier à lire, ou null s'il n'existe pas (ou plus) sur le disque.
  // Il est ouvert tout de suite : supprimé juste après, il reste lisible jusqu'au bout.
  async ouvrir(fichier: string): Promise<ReadStream | null> {
    const chemin = this.chemin(fichier);
    let poignee: FileHandle;
    try {
      poignee = await open(chemin, 'r');
    } catch {
      return null;
    }
    if (!(await poignee.stat()).isFile()) {
      await poignee.close();
      return null;
    }
    return poignee.createReadStream(); // se referme seul à la fin de la lecture
  }

  // Supprime le fichier ; déjà absent, ce n'est pas une erreur
  async supprimer(fichier: string): Promise<void> {
    try {
      await unlink(this.chemin(fichier));
    } catch (erreur) {
      if ((erreur as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw erreur;
      }
    }
  }

  // Le chemin sur le disque, en refusant tout ce qui sortirait du dossier (« ../../.env »)
  private chemin(fichier: string): string {
    const chemin = resolve(this.racine, fichier);
    if (!chemin.startsWith(this.racine + sep)) {
      throw new Error(`Chemin de fichier refusé : ${fichier}`);
    }
    return chemin;
  }
}
