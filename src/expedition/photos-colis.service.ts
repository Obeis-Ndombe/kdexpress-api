import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { PERSONNEL } from '../commun/roles.js';
import { PHOTOS_MAX, PhotoRecue, preparerPhoto } from '../fichiers/images.js';
import { StockageService } from '../fichiers/stockage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Les photos des colis : la preuve de l'emballage à Dubaï.
// Privées : seuls le personnel et le client du colis peuvent les voir.
@Injectable()
export class PhotosColisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockage: StockageService,
  ) {}

  // POST /colis/:id/photos
  async ajouter(idColis: number, photo: PhotoRecue | undefined) {
    await this.colisOuErreur(idColis);
    const image = await preparerPhoto(photo);
    const fichier = await this.stockage.enregistrer('colis', image);
    try {
      const cree = await this.prisma.$transaction(async (tx) => {
        // verrou sur le colis : deux photos envoyées en même temps passent l'une après l'autre
        await tx.$queryRaw`SELECT 1 FROM colis WHERE id_colis = ${idColis} FOR UPDATE`;
        const nombre = await tx.photoColis.count({ where: { idColis } });
        if (nombre >= PHOTOS_MAX) {
          throw new BadRequestException(
            `${PHOTOS_MAX} photos au plus par colis`,
          );
        }
        return tx.photoColis.create({
          data: { idColis, fichierPhotoColis: fichier },
        });
      });
      return {
        idPhotoColis: cree.idPhotoColis,
        idColis,
        url: `/colis/${idColis}/photos/${cree.idPhotoColis}`,
        date: cree.datePhotoColis,
      };
    } catch (erreur) {
      await this.stockage.supprimer(fichier); // rien en base : pas de fichier orphelin
      throw erreur;
    }
  }

  // GET /colis/:id/photos/:idPhoto : l'image elle-même.
  // Un client qui n'est pas celui du colis reçoit 404, comme pour les commandes.
  async lire(
    idColis: number,
    idPhoto: number,
    utilisateur: UtilisateurConnecte,
  ) {
    const photo = await this.prisma.photoColis.findFirst({
      where: {
        idPhotoColis: idPhoto,
        idColis,
        ...(PERSONNEL.includes(utilisateur.role)
          ? {}
          : { colis: { commande: { idClient: utilisateur.idUtilisateur } } }),
      },
    });
    const contenu =
      photo && (await this.stockage.ouvrir(photo.fichierPhotoColis));
    if (!contenu) {
      throw new NotFoundException(`Photo ${idPhoto} introuvable`);
    }
    return new StreamableFile(contenu, {
      type: 'image/webp',
      disposition: 'inline',
    });
  }

  private async colisOuErreur(idColis: number) {
    const colis = await this.prisma.colis.findUnique({ where: { idColis } });
    if (!colis) {
      throw new NotFoundException(`Colis ${idColis} introuvable`);
    }
  }
}
