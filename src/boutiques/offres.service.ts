import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OffreDto } from './dto/offre.dto.js';

// Les offres : le prix auquel une boutique de Dubaï vend une variante à KDExpress.
// Partagé par l'agent (boutiques sans compte) et le fournisseur (sa boutique).
@Injectable()
export class OffresService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(idBoutique: number) {
    const offres = await this.prisma.offreBoutique.findMany({
      where: { idBoutique },
      orderBy: { idVariante: 'asc' },
      include: {
        variante: {
          include: {
            produit: { select: { nomProduit: true, statutProduit: true } },
          },
        },
      },
    });
    return offres.map((o) => ({
      idVariante: o.idVariante,
      produit: o.variante.produit.nomProduit,
      statutProduit: o.variante.produit.statutProduit,
      variante: o.variante.libelleVariante,
      prixAed: o.prixBoutiqueAed.toFixed(2),
      disponible: o.estDisponible,
      misAJourLe: o.dateMiseAJour,
    }));
  }

  // Crée l'offre ou la met à jour (« upsert »). Le prix client ne bouge pas :
  // c'est la direction qui le décide, alertée si la marge devient nulle ou négative.
  async enregistrer(idBoutique: number, idVariante: number, dto: OffreDto) {
    const prix = new Prisma.Decimal(dto.prixAed);
    if (prix.lte(0)) {
      throw new BadRequestException('Le prix doit être supérieur à 0');
    }
    const variante = await this.prisma.variante.findUnique({
      where: { idVariante },
      include: { produit: true },
    });
    // un produit encore proposé n'accepte que les offres de la boutique qui l'a proposé
    const visible =
      variante &&
      (variante.produit.statutProduit === 'publie' ||
        (variante.produit.statutProduit === 'propose' &&
          variante.produit.idBoutiqueOrigine === idBoutique));
    if (!variante || !visible) {
      throw new BadRequestException(
        `L'article ${idVariante} n'est pas au catalogue`,
      );
    }
    const disponible = dto.disponible ?? true;
    const offre = await this.prisma.offreBoutique.upsert({
      where: { idBoutique_idVariante: { idBoutique, idVariante } },
      create: {
        idBoutique,
        idVariante,
        prixBoutiqueAed: prix,
        estDisponible: disponible,
      },
      update: { prixBoutiqueAed: prix, estDisponible: disponible },
    });
    return {
      idBoutique,
      idVariante,
      produit: variante.produit.nomProduit,
      variante: variante.libelleVariante,
      prixAed: offre.prixBoutiqueAed.toFixed(2),
      disponible: offre.estDisponible,
      misAJourLe: offre.dateMiseAJour,
    };
  }
}
