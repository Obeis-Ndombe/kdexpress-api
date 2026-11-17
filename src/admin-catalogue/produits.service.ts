import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutProduit } from '@prisma/client';
import { avecEssais, SERIALISABLE } from '../commun/transaction.js';
import { infosPage, pagination } from '../commun/pagination.js';
import { PHOTOS_MAX, PhotoRecue, preparerPhoto } from '../fichiers/images.js';
import {
  StockageService,
  urlPhotoProduit,
} from '../fichiers/stockage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreerProduitDto,
  DefinirPaliersDto,
  ModifierProduitDto,
  ModifierVarianteDto,
  VarianteDto,
} from './dto/produit.dto.js';
import {
  estErreurPrisma,
  margeVariante,
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
      offres: {
        orderBy: { prixBoutiqueAed: 'asc' },
        include: { boutique: { select: { nomBoutique: true } } },
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
  prixBoutique?: Prisma.Decimal; // produit proposé par une boutique : son offre
}

// Un produit proposé par une boutique : son id et le prix boutique de chaque variante
// (dans le même ordre que les variantes)
export interface OrigineBoutique {
  idBoutique: number;
  prixBoutique: Prisma.Decimal[];
}

@Injectable()
export class ProduitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockage: StockageService,
  ) {}

  // GET /admin/produits?statut=propose : tous les statuts, contrairement au catalogue public
  async lister(
    statut?: StatutProduit,
    idCategorie?: number,
    idMarque?: number,
    page = 1,
  ) {
    const where = { statutProduit: statut, idCategorie, idMarque };
    const total = await this.prisma.produit.count({ where });
    const produits = await this.prisma.produit.findMany({
      where,
      ...pagination(page),
      orderBy: { idProduit: 'desc' },
      include: {
        categorie: true,
        marque: true,
        photos: { orderBy: { ordreAffichage: 'asc' }, take: 1 },
        _count: { select: { variantes: true } },
      },
    });
    return {
      ...infosPage(page, total),
      produits: produits.map((p) => ({
        idProduit: p.idProduit,
        nom: p.nomProduit,
        statut: p.statutProduit,
        categorie: p.categorie.nomCategorie,
        marque: p.marque?.nomMarque ?? null,
        photo: p.photos[0]
          ? urlPhotoProduit(p.photos[0].fichierPhotoProduit)
          : null,
        nombreVariantes: p._count.variantes,
        idBoutiqueOrigine: p.idBoutiqueOrigine,
      })),
    };
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
  // Avec « origine » (proposition d'une boutique) : le produit reste « propose »,
  // il garde sa boutique d'origine, et chaque variante reçoit l'offre de la boutique.
  async creer(dto: CreerProduitDto, origine?: OrigineBoutique) {
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
    origine?.prixBoutique.forEach((prix, i) => {
      variantes[i].prixBoutique = prix;
    });

    const produit = await this.prisma.produit.create({
      data: {
        nomProduit: dto.nom,
        descriptionProduit: dto.description,
        statutProduit: dto.publier && !origine ? 'publie' : 'propose',
        idCategorie: dto.idCategorie,
        idMarque: dto.idMarque,
        idBoutiqueOrigine: origine?.idBoutique,
        caracteristiques: {
          create: (dto.caracteristiques ?? []).map((c) => ({
            idCaracteristique: c.idCaracteristique,
            valeur: c.valeur,
          })),
        },
        variantes: {
          create: variantes.map((v) =>
            this.donneesVariante(v, origine?.idBoutique),
          ),
        },
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

  // POST /admin/produits/:id/photos : la photo est vérifiée, compressée, rangée,
  // puis ajoutée à la fin dans l'ordre d'affichage.
  // Avec « pourBoutique » : seulement sur une proposition de cette boutique encore en attente.
  async ajouterPhoto(
    idProduit: number,
    photo: PhotoRecue | undefined,
    pourBoutique?: number,
  ) {
    await this.produitPourPhoto(this.prisma, idProduit, pourBoutique);
    const image = await preparerPhoto(photo);
    const fichier = await this.stockage.enregistrer('produits', image);
    try {
      await this.prisma.$transaction(async (tx) => {
        // Verrou sur la ligne du produit : les photos envoyées en même temps
        // (sélection multiple dans l'appli) passent l'une après l'autre, sans conflit
        await tx.$queryRaw`SELECT 1 FROM produit WHERE id_produit = ${idProduit} FOR UPDATE`;
        // on revérifie : le produit a pu changer pendant la compression
        await this.produitPourPhoto(tx, idProduit, pourBoutique);
        const photos = await tx.photoProduit.aggregate({
          where: { idProduit },
          _max: { ordreAffichage: true },
          _count: true,
        });
        if (photos._count >= PHOTOS_MAX) {
          throw new BadRequestException(
            `${PHOTOS_MAX} photos au plus par produit`,
          );
        }
        await tx.photoProduit.create({
          data: {
            idProduit,
            fichierPhotoProduit: fichier,
            ordreAffichage: (photos._max.ordreAffichage ?? 0) + 1,
          },
        });
      });
    } catch (erreur) {
      await this.stockage.supprimer(fichier); // rien en base : pas de fichier orphelin
      throw erreur;
    }
    return this.detail(idProduit);
  }

  // DELETE /admin/photos/:id : en base, puis sur le disque
  async supprimerPhoto(idPhoto: number) {
    const photo = await this.prisma.photoProduit
      .delete({ where: { idPhotoProduit: idPhoto } })
      .catch((erreur: unknown) => {
        if (estErreurPrisma(erreur, 'P2025')) {
          throw new NotFoundException(`Photo ${idPhoto} introuvable`);
        }
        throw erreur;
      });
    await this.stockage.supprimer(photo.fichierPhotoProduit);
    return this.detail(photo.idProduit);
  }

  // ------- outils internes -------

  // Le produit peut-il recevoir une photo ? (404 s'il n'existe pas ou n'est pas à cette boutique)
  private async produitPourPhoto(
    client: Prisma.TransactionClient,
    idProduit: number,
    pourBoutique?: number,
  ) {
    const produit = await client.produit.findUnique({ where: { idProduit } });
    if (
      !produit ||
      (pourBoutique !== undefined && produit.idBoutiqueOrigine !== pourBoutique)
    ) {
      throw new NotFoundException(`Produit ${idProduit} introuvable`);
    }
    if (pourBoutique !== undefined && produit.statutProduit !== 'propose') {
      throw new BadRequestException(
        `Un produit « ${produit.statutProduit} » n'est plus modifiable par la boutique`,
      );
    }
  }

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
  private donneesVariante(v: VarianteVerifiee, idBoutique?: number) {
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
      offres:
        idBoutique !== undefined && v.prixBoutique
          ? { create: { idBoutique, prixBoutiqueAed: v.prixBoutique } }
          : undefined,
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
        url: urlPhotoProduit(ph.fichierPhotoProduit),
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
        ...margeVariante(v.prixCatalogueAed, v.offres),
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
        offres: v.offres.map((o) => ({
          idBoutique: o.idBoutique,
          boutique: o.boutique.nomBoutique,
          prixAed: o.prixBoutiqueAed.toFixed(2),
          disponible: o.estDisponible,
          misAJourLe: o.dateMiseAJour,
        })),
      })),
    };
  }
}
