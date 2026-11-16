import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { preparerPhoto, type PhotoRecue } from './images.js';
import { StockageService } from './stockage.service.js';

const recue = (buffer: Buffer): PhotoRecue => ({
  buffer,
  size: buffer.length,
  originalname: 'photo.jpg',
});

// une image de test fabriquée à la volée
const image = (largeur: number, hauteur: number, format: 'jpeg' | 'png') =>
  sharp({
    create: {
      width: largeur,
      height: hauteur,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .toFormat(format)
    .toBuffer();

describe('preparerPhoto', () => {
  it('réduit une grande photo à 1600 px et la convertit en WebP', async () => {
    const sortie = await preparerPhoto(recue(await image(4000, 3000, 'jpeg')));
    const infos = await sharp(sortie).metadata();
    expect(infos.format).toBe('webp');
    expect([infos.width, infos.height]).toEqual([1600, 1200]);
  });

  it("n'agrandit pas une petite image", async () => {
    const infos = await sharp(
      await preparerPhoto(recue(await image(300, 200, 'png'))),
    ).metadata();
    expect([infos.width, infos.height]).toEqual([300, 200]);
  });

  it('efface les métadonnées (dont la position GPS)', async () => {
    const avecExif = await sharp(await image(800, 600, 'jpeg'))
      .withExif({ IFD0: { Make: 'TestPhone', Copyright: 'secret' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(avecExif).metadata()).exif).toBeDefined();
    const sortie = await preparerPhoto(recue(avecExif));
    expect((await sharp(sortie).metadata()).exif).toBeUndefined();
  });

  it('refuse ce qui n’est pas une image, et l’absence de fichier', async () => {
    await expect(
      preparerPhoto(recue(Buffer.from('ceci est un texte'))),
    ).rejects.toThrow("n'est pas une image");
    await expect(preparerPhoto(undefined)).rejects.toThrow(BadRequestException);
  });
});

describe('StockageService', () => {
  let dossier: string;
  let stockage: StockageService;

  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), 'kdx-'));
    const config = { get: () => dossier } as unknown as ConfigService;
    stockage = new StockageService(config);
  });

  afterEach(() => rm(dossier, { recursive: true, force: true }));

  it('range sous un nom tiré au hasard, relit, puis supprime', async () => {
    const fichier = await stockage.enregistrer('produits', Buffer.from('abc'));
    expect(fichier).toMatch(/^produits\/[0-9a-f-]{36}\.webp$/);
    expect(await readFile(join(dossier, fichier), 'utf8')).toBe('abc');
    const lecture = await stockage.ouvrir(fichier);
    expect(lecture).not.toBeNull();
    lecture?.destroy(); // on referme le fichier ouvert
    await stockage.supprimer(fichier);
    expect(await stockage.ouvrir(fichier)).toBeNull();
    await expect(stockage.supprimer(fichier)).resolves.toBeUndefined(); // déjà absent : pas d'erreur
  });

  it('un fichier ouvert reste lisible même supprimé juste après', async () => {
    const fichier = await stockage.enregistrer('colis', Buffer.from('photo'));
    const lecture = await stockage.ouvrir(fichier);
    await stockage.supprimer(fichier);
    const morceaux: Buffer[] = [];
    for await (const morceau of lecture!) {
      morceaux.push(morceau as Buffer);
    }
    expect(Buffer.concat(morceaux).toString()).toBe('photo');
  });

  it('refuse tout chemin qui sort du dossier', async () => {
    await expect(stockage.ouvrir('../../.env')).rejects.toThrow('refusé');
    await expect(stockage.supprimer('../secret.txt')).rejects.toThrow('refusé');
  });
});
