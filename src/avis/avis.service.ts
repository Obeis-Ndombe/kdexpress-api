import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { infosPage, pagination } from '../commun/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DonnerAvisDto } from './dto/donner-avis.dto.js';

@Injectable()
export class AvisService {
  constructor(private readonly prisma: PrismaService) {}

  // Le client note le service, une fois sa commande récupérée
  async donner(
    idCommande: number,
    dto: DonnerAvisDto,
    client: UtilisateurConnecte,
  ) {
    const commande = await this.prisma.commande.findFirst({
      where: { idCommande, idClient: client.idUtilisateur }, // seulement SA commande
      select: {
        numeroCommande: true,
        historique: { select: { etape: { select: { ordreEtape: true } } } },
      },
    });
    if (!commande) {
      throw new NotFoundException(`Commande ${idCommande} introuvable`);
    }
    const recuperee = commande.historique.some(
      (h) => h.etape.ordreEtape === ORDRE_ETAPE.RECUPEREE,
    );
    if (!recuperee) {
      throw new BadRequestException(
        'Vous pourrez donner votre avis après avoir récupéré votre commande',
      );
    }

    try {
      const avis = await this.prisma.avisService.create({
        data: {
          idCommande,
          noteSur5: dto.note,
          commentaireAvis: dto.commentaire,
        },
      });
      return {
        idAvis: avis.idAvisService,
        numeroCommande: commande.numeroCommande,
        note: avis.noteSur5,
        commentaire: avis.commentaireAvis,
        date: avis.dateAvis,
      };
    } catch (erreur) {
      // P2002 : un seul avis par commande (colonne unique)
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === 'P2002'
      ) {
        throw new ConflictException(
          'Vous avez déjà donné votre avis sur cette commande',
        );
      }
      throw erreur;
    }
  }

  // GET /avis : tous les avis, la moyenne et le nombre
  async lister(page = 1) {
    const [stats, avis] = await Promise.all([
      this.prisma.avisService.aggregate({
        _avg: { noteSur5: true },
        _count: true,
      }),
      this.prisma.avisService.findMany({
        ...pagination(page),
        orderBy: { idAvisService: 'desc' },
        include: {
          commande: {
            select: {
              numeroCommande: true,
              client: { select: { nom: true, prenom: true } },
            },
          },
        },
      }),
    ]);
    return {
      ...infosPage(page, stats._count),
      nombre: stats._count,
      moyenne:
        stats._avg.noteSur5 === null
          ? null
          : Number(stats._avg.noteSur5.toFixed(1)),
      avis: avis.map((a) => ({
        idAvis: a.idAvisService,
        numeroCommande: a.commande.numeroCommande,
        client: `${a.commande.client.prenom} ${a.commande.client.nom}`,
        note: a.noteSur5,
        commentaire: a.commentaireAvis,
        date: a.dateAvis,
      })),
    };
  }
}
