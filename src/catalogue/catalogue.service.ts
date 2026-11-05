import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// Un prix affiché au client : en dirhams et en dollars
export interface Prix {
  aed: string;
  usd: string;
}

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /catalogue/categories
  listerCategories() {
    return this.prisma.categorie.findMany({
      select: { idCategorie: true, nomCategorie: true },
      orderBy: { nomCategorie: 'asc' },
    });
  }

  // GET /catalogue/produits?categorie=1&marque=2
  async listerProduits(idCategorie?: number, idMarque?: number) {
    // le taux AED -> USD vient des paramètres de la direction
    const taux = await this.tauxChange(); 

    const produits = await this.prisma.produit.findMany({
      // un filtre « undefined » est ignoré par Prisma
      where: { statutProduit: 'publie', idCategorie, idMarque },
      orderBy: { nomProduit: 'asc' },
      include: {
        marque: true,
        categorie: true,
        photos: { orderBy: { ordreAffichage: 'asc' }, take: 1 },
        variantes: {
          where: { estEnVente: true },
          orderBy: { prixCatalogueAed: 'asc' },
          take: 1, // la moins chère, pour « à partir de »
        },
      },
    });

    return produits.map((p) => ({
      idProduit: p.idProduit,
      nom: p.nomProduit,
      marque: p.marque?.nomMarque ?? null,
      categorie: p.categorie.nomCategorie,
      photo: p.photos[0]?.fichierPhotoProduit ?? null,
      // le prix « à partir de » est celui de la variante la moins chère, si elle existe
      prixAPartirDe: p.variantes[0] ? this.prix(p.variantes[0].prixCatalogueAed, taux) : null,
    }));
  }

  // GET /catalogue/produits/:id
  async detailProduit(idProduit: number) {
    const taux = await this.tauxChange();

    const p = await this.prisma.produit.findFirst({
      where: { idProduit, statutProduit: 'publie' },
      include: {
        marque: true,
        categorie: true,
        photos: { orderBy: { ordreAffichage: 'asc' } },
        caracteristiques: { include: { caracteristique: true } },
        variantes: {
          where: { estEnVente: true },
          orderBy: { prixCatalogueAed: 'asc' },
          include: {
            paliers: { orderBy: { quantiteMinimum: 'asc' } },
            caracteristiques: { include: { caracteristique: true } },
          },
        },
      },
    });

    if (!p) {
      throw new NotFoundException(`Produit ${idProduit} introuvable`);
    }

    return {
      idProduit: p.idProduit,
      nom: p.nomProduit,
      description: p.descriptionProduit,
      marque: p.marque?.nomMarque ?? null,
      categorie: p.categorie.nomCategorie,
      photos: p.photos.map((photo) => photo.fichierPhotoProduit),
      caracteristiques: p.caracteristiques.map((c) => ({
        nom: c.caracteristique.nomCaracteristique,
        valeur: this.avecUnite(c.valeur, c.caracteristique.uniteMesure),
      })),
      variantes: p.variantes.map((v) => ({
        idVariante: v.idVariante,
        libelle: v.libelleVariante,
        prix: this.prix(v.prixCatalogueAed, taux),
        poidsEstimeKg: v.poidsEstimeKg.toFixed(3),
        options: v.caracteristiques.map((c) => ({
          nom: c.caracteristique.nomCaracteristique,
          valeur: this.avecUnite(c.valeur, c.caracteristique.uniteMesure),
        })),
        paliers: v.paliers.map((palier) => ({
          aPartirDe: palier.quantiteMinimum,
          prix: this.prix(palier.prixPalierAed, taux),
        })),
      })),
    };
  }

  // ------- outils internes (private : invisibles hors du service) -------

  // le taux AED -> USD vient des paramètres de la direction
  private async tauxChange(): Promise<Prisma.Decimal> {
    const parametre = await this.prisma.parametre.findUnique({
      where: { codeParametre: 'taux_change_aed_usd' },
    });
    return new Prisma.Decimal(parametre?.valeurParametre || '0');
  }

  // Prisma.Decimal est un type numérique précis, 
  // mais on veut afficher un prix avec 2 décimales.
  private prix(aed: Prisma.Decimal, taux: Prisma.Decimal): Prix {
    //mul() multiplie deux nombres décimaux, toFixed(2) arrondit à 2 décimales.
    return { aed: aed.toFixed(2), usd: aed.mul(taux).toFixed(2) };
  }

  // si la caractéristique a une unité de mesure, on l'ajoute à la valeur
  private avecUnite(valeur: string, unite: string | null): string {
    return unite ? `${valeur} ${unite}` : valeur;
  }
}



