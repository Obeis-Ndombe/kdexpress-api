import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutProduit } from '@prisma/client';
import { avecEssais, SERIALISABLE } from '../commun/transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AjouterPhotoDto,
  CreerProduitDto,
  DefinirPaliersDto,
  ModifierProduitDto,
  ModifierVarianteDto,
  VarianteDto,
} from './dto/produit.dto.js';
import {
  estErreurPrisma,
  montantPositif,
  verifierCaracteristiques,
  verifierPaliers,
} from './regles-catalogue.js';

// tout ce qu'il faut pour afficher un produit à l'administration
const INCLUSION_PRODUIT = {
  categorie: true,
  marque: true,
  photos: { orderBy: { ordreAffichage: 'asc' } },
  caracteristiques: {
    include: { caracteristique: true },
    orderBy: { idCaracteristique: 'asc' },
  },
  variantes: {
    orderBy: { idVariante: 'asc' },
    include: {
      paliers: { orderBy: { quantiteMinimum: 'asc' } },
      caracteristiques: {
        include: { caracteristique: true },
        orderBy: { idCaracteristique: 'asc' },
      },
    },
  },
} satisfies Prisma.ProduitInclude;

type ProduitComplet = Prisma.ProduitGetPayload<{
  include: typeof INCLUSION_PRODUIT;
}>;

// Une variante vérifiée, prête à être écrite
interface VarianteVerifiee {
  libelle: string;
  prix: Prisma.Decimal;
  poids: Prisma.Decimal;
  options: { idCaracteristique: number; valeur: string }[];
  paliers: { aPartirDe: number; prix: Prisma.Decimal }[];
}

@Injectable()
export class ProduitsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /admin/produits?statut=propose : tous les statuts, contrairement au catalogue public
  async lister(
    statut?: StatutProduit,
    idCategorie?: number,
    idMarque?: number,
  ) {
    const produits = await this.prisma.produit.findMany({
      where: { statutProduit: statut, idCategorie, idMarque },
      orderBy: { idProduit: 'desc' },
      include: {
        categorie: true,
        marque: true,
        photos: { orderBy: { ordreAffichage: 'asc' }, take: 1 },
        _count: { select: { variantes: true } },
      },
    });
    return produits.map((p) => ({
      idProduit: p.idProduit,
      nom: p.nomProduit,
      statut: p.statutProduit,
      categorie: p.categorie.nomCategorie,
      marque: p.marque?.nomMarque ?? null,
      photo: p.photos[0]?.fichierPhotoProduit ?? null,
      nombreVariantes: p._count.variantes,
      idBoutiqueOrigine: p.idBoutiqueOrigine,
    }));
  }

  // GET /admin/produits/:id : même les variantes retirées de la vente
  async detail(idProduit: number) {
    const produit = await this.prisma.produit.findUnique({
      where: { idProduit },
      include: INCLUSION_PRODUIT,
    });
    if (!produit) {
      throw new NotFoundException(`Produit ${idProduit} introuvable`);
    }
    return this.presenter(produit);
  }

  // POST /admin/produits : tout est vérifié AVANT d'écrire, puis une seule écriture
  // crée le produit, ses photos, ses caractéristiques, ses variantes, leurs options et leurs paliers.
  // Si quoi que ce soit échoue, rien n'est créé.
  async creer(dto: CreerProduitDto) {
    const categorie = await this.prisma.categorie.findUnique({
      where: { idCategorie: dto.idCategorie },
    });
    if (!categorie) {
      throw new BadRequestException(`Catégorie ${dto.idCategorie} inconnue`);
    }
    await this.verifierMarque(dto.idMarque);
    await verifierCaracteristiques(
      this.prisma,
      dto.idCategorie,
      dto.caracteristiques ?? [],
      'description',
    );

    const variantes = await this.preparerVariantes(
      dto.variantes,
      categorie.idCategorie,
      categorie.poidsParDefautKg,
    );

    const produit = await this.prisma.produit.create({
      data: {
        nomProduit: dto.nom,
        descriptionProduit: dto.description,
        statutProduit: dto.publier ? 'publie' : 'propose',
        idCategorie: dto.idCategorie,
        idMarque: dto.idMarque,
        photos: {
          create: (dto.photos ?? []).map((fichier, i) => ({
            fichierPhotoProduit: fichier,
            ordreAffichage: i + 1,
          })),
        },
        caracteristiques: {
          create: (dto.caracteristiques ?? []).map((c) => ({
            idCaracteristique: c.idCaracteristique,
            valeur: c.valeur,
          })),
        },
        variantes: { create: variantes.map((v) => this.donneesVariante(v)) },
      },
      include: INCLUSION_PRODUIT,
    });
    return this.presenter(produit);
  }

  // PATCH /admin/produits/:id
  async modifier(idProduit: number, dto: ModifierProduitDto) {
    if (dto.idMarque) {
      await this.verifierMarque(dto.idMarque);
    }
    try {
      const produit = await this.prisma.produit.update({
        where: { idProduit },
        data: {
          nomProduit: dto.nom,
          descriptionProduit: dto.description,
          idMarque: dto.idMarque, // null : la marque est retirée
        },
        include: INCLUSION_PRODUIT,
      });
      return this.presenter(produit);
    } catch (erreur) {
      if (estErreurPrisma(erreur, 'P2025')) {
        throw new NotFoundException(`Produit ${idProduit} introuvable`);
      }
      throw erreur;
    }
  }

  // ------- statuts -------
  // propose -> publie | refuse ; publie -> retire ; retire -> publie

  publier(idProduit: number) {
    return this.changerStatut(idProduit, 'publie', ['propose', 'retire']);
  }

  refuser(idProduit: number) {
    return this.changerStatut(idProduit, 'refuse', ['propose']);
  }

  retirer(idProduit: number) {
    return this.changerStatut(idProduit, 'retire', ['publie']);
  }

  private async changerStatut(
    idProduit: number,
    vers: StatutProduit,
    depuis: StatutProduit[],
  ) {
    if (vers === 'publie') {
      const enVente = await this.prisma.variante.count({
        where: { idProduit, estEnVente: true },
      });
      if (enVente === 0) {
        // (un produit inexistant passe aussi par ici : le 404 vient plus bas)
        const existe = await this.prisma.produit.count({
          where: { idProduit },
        });
        if (existe) {
          throw new BadRequestException(
            'Impossible de publier : aucune variante en vente',
          );
        }
      }
    }
    // « updateMany ... where statut dans depuis » : le contrôle et le changement
    // ne font qu'un, donc deux demandes simultanées ne peuvent pas se contredire
    const resultat = await this.prisma.produit.updateMany({
      where: { idProduit, statutProduit: { in: depuis } },
      data: { statutProduit: vers },
    });
    if (resultat.count === 0) {
      const produit = await this.prisma.produit.findUnique({
        where: { idProduit },
      });
      if (!produit) {
        throw new NotFoundException(`Produit ${idProduit} introuvable`);
      }
      throw new BadRequestException(
        `Un produit « ${produit.statutProduit} » ne peut pas passer à « ${vers} »`,
      );
    }
    return this.detail(idProduit);
  }

  // ------- variantes -------

  // POST /admin/produits/:id/variantes
  async ajouterVariante(idProduit: number, dto: VarianteDto) {
    const produit = await this.prisma.produit.findUnique({
      where: { idProduit },
      include: { categorie: true },
    });
    if (!produit) {
      throw new NotFoundException(`Produit ${idProduit} introuvable`);
    }
    const [variante] = await this.preparerVariantes(
      [dto],
      produit.idCategorie,
      produit.categorie.poidsParDefautKg,
    );
    try {
      await this.prisma.variante.create({
        data: { idProduit, ...this.donneesVariante(variante) },
      });
    } catch (erreur) {
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(
          `Ce produit a déjà une variante « ${variante.libelle} »`,
        );
      }
      throw erreur;
    }
    return this.detail(idProduit);
  }

  // PATCH /admin/variantes/:id : un nouveau prix ne touche que les futures commandes
  // (les commandes déjà passées ont leur prix figé). Les paliers existants doivent
  // rester moins chers que le nouveau prix : lecture et écriture dans la même transaction.
  async modifierVariante(idVariante: number, dto: ModifierVarianteDto) {
    const idProduit = await avecEssais(
      () =>
        this.prisma.$transaction(async (tx) => {
          const variante = await tx.variante.findUnique({
            where: { idVariante },
            include: { paliers: true },
          });
          if (!variante) {
            throw new NotFoundException(`Variante ${idVariante} introuvable`);
          }
          const prix =
            dto.prixCatalogueAed === undefined
              ? undefined
              : montantPositif(dto.prixCatalogueAed, 'Le prix');
          const poids =
            dto.poidsEstimeKg === undefined
              ? undefined
              : montantPositif(dto.poidsEstimeKg, 'Le poids');
          if (prix) {
            verifierPaliers(
              prix,
              variante.paliers.map((p) => ({
                aPartirDe: p.quantiteMinimum,
                prixAed: p.prixPalierAed.toFixed(2),
              })),
            );
          }
          await tx.variante.update({
            where: { idVariante },
            data: {
              libelleVariante: dto.libelle,
              prixCatalogueAed: prix,
              poidsEstimeKg: poids,
              estEnVente: dto.estEnVente,
            },
          });
          return variante.idProduit;
        }, SERIALISABLE),
      'Modification en conflit avec une autre, réessayez',
    ).catch((erreur: unknown) => {
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(
          `Ce produit a déjà une variante « ${dto.libelle} »`,
        );
      }
      throw erreur;
    });
    return this.detail(idProduit);
  }

  // PUT /admin/variantes/:id/paliers : la liste complète remplace l'ancienne
  async definirPaliers(idVariante: number, dto: DefinirPaliersDto) {
    const idProduit = await avecEssais(
      () =>
        this.prisma.$transaction(async (tx) => {
          const variante = await tx.variante.findUnique({
            where: { idVariante },
          });
          if (!variante) {
            throw new NotFoundException(`Variante ${idVariante} introuvable`);
          }
          verifierPaliers(variante.prixCatalogueAed, dto.paliers);
          await tx.palierPrix.deleteMany({ where: { idVariante } });
          await tx.palierPrix.createMany({
            data: dto.paliers.map((p) => ({
              idVariante,
              quantiteMinimum: p.aPartirDe,
              prixPalierAed: new Prisma.Decimal(p.prixAed),
            })),
          });
          return variante.idProduit;
        }, SERIALISABLE),
      'Modification en conflit avec une autre, réessayez',
    );
    return this.detail(idProduit);
  }

  // ------- photos -------

  // POST /admin/produits/:id/photos : ajoutée à la fin, dans l'ordre d'affichage
  async ajouterPhoto(idProduit: number, dto: AjouterPhotoDto) {
    await avecEssais(
      () =>
        this.prisma.$transaction(async (tx) => {
          const produit = await tx.produit.findUnique({ where: { idProduit } });
          if (!produit) {
            throw new NotFoundException(`Produit ${idProduit} introuvable`);
          }
          const derniere = await tx.photoProduit.aggregate({
            where: { idProduit },
            _max: { ordreAffichage: true },
          });
          await tx.photoProduit.create({
            data: {
              idProduit,
              fichierPhotoProduit: dto.fichier,
              ordreAffichage: (derniere._max.ordreAffichage ?? 0) + 1,
            },
          });
        }, SERIALISABLE),
      'Ajout en conflit avec un autre, réessayez',
    );
    return this.detail(idProduit);
  }

  // ------- outils internes -------

  private async verifierMarque(idMarque?: number) {
    if (idMarque === undefined) {
      return;
    }
    const marque = await this.prisma.marque.findUnique({ where: { idMarque } });
    if (!marque) {
      throw new BadRequestException(`Marque ${idMarque} inconnue`);
    }
  }

  // Vérifie une liste de variantes : libellés distincts, prix et poids positifs,
  // paliers cohérents, options prévues pour la catégorie
  private async preparerVariantes(
    variantes: VarianteDto[],
    idCategorie: number,
    poidsParDefaut: Prisma.Decimal,
  ): Promise<VarianteVerifiee[]> {
    const resultat: VarianteVerifiee[] = [];
    const libelles = new Set<string>();
    for (const v of variantes) {
      const libelle = v.libelle ?? 'Standard';
      if (libelles.has(libelle)) {
        throw new BadRequestException(
          `Deux variantes s'appellent « ${libelle} »`,
        );
      }
      libelles.add(libelle);

      const prix = montantPositif(v.prixCatalogueAed, 'Le prix');
      const poids =
        v.poidsEstimeKg === undefined
          ? poidsParDefaut
          : montantPositif(v.poidsEstimeKg, 'Le poids');
      verifierPaliers(prix, v.paliers ?? []);
      await verifierCaracteristiques(
        this.prisma,
        idCategorie,
        v.options ?? [],
        'choix_variante',
      );
      resultat.push({
        libelle,
        prix,
        poids,
        options: (v.options ?? []).map((o) => ({
          idCaracteristique: o.idCaracteristique,
          valeur: o.valeur,
        })),
        paliers: (v.paliers ?? []).map((p) => ({
          aPartirDe: p.aPartirDe,
          prix: new Prisma.Decimal(p.prixAed),
        })),
      });
    }
    return resultat;
  }

  // la variante vérifiée, au format de l'écriture imbriquée de Prisma
  private donneesVariante(v: VarianteVerifiee) {
    return {
      libelleVariante: v.libelle,
      prixCatalogueAed: v.prix,
      poidsEstimeKg: v.poids,
      paliers: {
        create: v.paliers.map((p) => ({
          quantiteMinimum: p.aPartirDe,
          prixPalierAed: p.prix,
        })),
      },
      caracteristiques: { create: v.options },
    };
  }

  private presenter(p: ProduitComplet) {
    return {
      idProduit: p.idProduit,
      nom: p.nomProduit,
      description: p.descriptionProduit,
      statut: p.statutProduit,
      categorie: {
        idCategorie: p.categorie.idCategorie,
        nom: p.categorie.nomCategorie,
      },
      marque: p.marque
        ? { idMarque: p.marque.idMarque, nom: p.marque.nomMarque }
        : null,
      idBoutiqueOrigine: p.idBoutiqueOrigine,
      photos: p.photos.map((ph) => ({
        idPhoto: ph.idPhotoProduit,
        fichier: ph.fichierPhotoProduit,
        ordre: ph.ordreAffichage,
      })),
      caracteristiques: p.caracteristiques.map((c) => ({
        idCaracteristique: c.idCaracteristique,
        nom: c.caracteristique.nomCaracteristique,
        valeur: c.valeur,
      })),
      variantes: p.variantes.map((v) => ({
        idVariante: v.idVariante,
        libelle: v.libelleVariante,
        prixCatalogueAed: v.prixCatalogueAed.toFixed(2),
        poidsEstimeKg: v.poidsEstimeKg.toFixed(3),
        estEnVente: v.estEnVente,
        options: v.caracteristiques.map((c) => ({
          idCaracteristique: c.idCaracteristique,
          nom: c.caracteristique.nomCaracteristique,
          valeur: c.valeur,
        })),
        paliers: v.paliers.map((pa) => ({
          aPartirDe: pa.quantiteMinimum,
          prixAed: pa.prixPalierAed.toFixed(2),
        })),
      })),
    };
  }
}
