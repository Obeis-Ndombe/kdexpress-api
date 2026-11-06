import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatutBoutique } from '@prisma/client';
import { estErreurPrisma } from '../admin-catalogue/regles-catalogue.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RattacherGestionnaireDto } from './dto/rattacher-gestionnaire.dto.js';

// La direction relie les comptes « fournisseur » à leur boutique et vérifie les boutiques.
// Statuts : non_inscrite (pas de compte) -> en_attente (un compte rattaché)
//           -> verifiee | refusee ; refusee <-> verifiee
@Injectable()
export class GestionBoutiquesService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(idBoutique: number) {
    const boutique = await this.prisma.boutique.findUnique({
      where: { idBoutique },
      include: {
        gestionnaires: {
          orderBy: { dateRattachement: 'asc' },
          include: {
            utilisateur: {
              select: { nom: true, prenom: true, email: true, telephone: true },
            },
          },
        },
        _count: { select: { offres: true, produitsSoumis: true } },
      },
    });
    if (!boutique) {
      throw new NotFoundException(`Boutique ${idBoutique} introuvable`);
    }
    return {
      idBoutique: boutique.idBoutique,
      nom: boutique.nomBoutique,
      adresse: boutique.adresseBoutique,
      telephone: boutique.telephoneBoutique,
      statut: boutique.statutBoutique,
      nombreOffres: boutique._count.offres,
      nombreProduitsProposes: boutique._count.produitsSoumis,
      gestionnaires: boutique.gestionnaires.map((g) => ({
        idUtilisateur: g.idUtilisateur,
        ...g.utilisateur,
        role: g.roleBoutique,
        rattacheLe: g.dateRattachement,
      })),
    };
  }

  // Le premier compte rattaché fait passer la boutique « non inscrite » à « en attente »
  async rattacher(idBoutique: number, dto: RattacherGestionnaireDto) {
    await this.ecrireRattachement(idBoutique, dto).catch((erreur: unknown) => {
      // deux rattachements identiques au même instant : le second bute sur la clé
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(
          'Ce compte est déjà rattaché à cette boutique',
        );
      }
      throw erreur;
    });
    return this.detail(idBoutique);
  }

  private ecrireRattachement(
    idBoutique: number,
    dto: RattacherGestionnaireDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const boutique = await tx.boutique.findUnique({ where: { idBoutique } });
      if (!boutique) {
        throw new NotFoundException(`Boutique ${idBoutique} introuvable`);
      }
      const utilisateur = await tx.utilisateur.findUnique({
        where: { idUtilisateur: dto.idUtilisateur },
      });
      if (!utilisateur) {
        throw new BadRequestException(
          `Utilisateur ${dto.idUtilisateur} inconnu`,
        );
      }
      if (utilisateur.roleUtilisateur !== 'fournisseur') {
        throw new BadRequestException(
          'Seul un compte « fournisseur » peut gérer une boutique',
        );
      }
      const deja = await tx.gestionBoutique.findUnique({
        where: {
          idUtilisateur_idBoutique: {
            idUtilisateur: dto.idUtilisateur,
            idBoutique,
          },
        },
      });
      if (deja) {
        throw new ConflictException(
          'Ce compte est déjà rattaché à cette boutique',
        );
      }
      await tx.gestionBoutique.create({
        data: {
          idUtilisateur: dto.idUtilisateur,
          idBoutique,
          roleBoutique: dto.role,
        },
      });
      await tx.boutique.updateMany({
        where: { idBoutique, statutBoutique: 'non_inscrite' },
        data: { statutBoutique: 'en_attente' },
      });
    });
  }

  async detacher(idBoutique: number, idUtilisateur: number) {
    const resultat = await this.prisma.gestionBoutique.deleteMany({
      where: { idBoutique, idUtilisateur },
    });
    if (resultat.count === 0) {
      throw new NotFoundException(
        `Le compte ${idUtilisateur} ne gère pas la boutique ${idBoutique}`,
      );
    }
    return this.detail(idBoutique);
  }

  // Une boutique sans compte rattaché ne peut pas être vérifiée : il n'y a personne pour la tenir
  verifier(idBoutique: number) {
    return this.changerStatut(idBoutique, 'verifiee', [
      'en_attente',
      'refusee',
    ]);
  }

  refuser(idBoutique: number) {
    return this.changerStatut(idBoutique, 'refusee', [
      'en_attente',
      'verifiee',
    ]);
  }

  private async changerStatut(
    idBoutique: number,
    vers: StatutBoutique,
    depuis: StatutBoutique[],
  ) {
    // contrôle et changement en une seule requête, comme pour les produits
    const resultat = await this.prisma.boutique.updateMany({
      where: { idBoutique, statutBoutique: { in: depuis } },
      data: { statutBoutique: vers },
    });
    if (resultat.count === 0) {
      const boutique = await this.prisma.boutique.findUnique({
        where: { idBoutique },
      });
      if (!boutique) {
        throw new NotFoundException(`Boutique ${idBoutique} introuvable`);
      }
      throw new BadRequestException(
        `Une boutique « ${boutique.statutBoutique} » ne peut pas passer à « ${vers} »`,
      );
    }
    return this.detail(idBoutique);
  }
}
