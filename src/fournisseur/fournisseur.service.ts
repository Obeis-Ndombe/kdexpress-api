import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreerProduitDto } from '../admin-catalogue/dto/produit.dto.js';
import { ProduitsService } from '../admin-catalogue/produits.service.js';
import {
  montantPositif,
  prixAvecMarge,
} from '../admin-catalogue/regles-catalogue.js';
import { OffreDto } from '../boutiques/dto/offre.dto.js';
import { OffresService } from '../boutiques/offres.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ModifierPropositionDto,
  PropositionProduitDto,
} from './dto/proposition-produit.dto.js';

// L'espace du fournisseur : ses boutiques, ses propositions de produits, ses offres.
// Il ne voit et ne touche QUE les boutiques auxquelles la direction l'a rattaché.
@Injectable()
export class FournisseurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly produits: ProduitsService,
    private readonly offres: OffresService,
  ) {}

  // GET /fournisseur/boutiques
  async mesBoutiques(idUtilisateur: number) {
    const liens = await this.prisma.gestionBoutique.findMany({
      where: { idUtilisateur },
      include: { boutique: true },
      orderBy: { idBoutique: 'asc' },
    });
    return liens.map((l) => ({
      idBoutique: l.idBoutique,
      nom: l.boutique.nomBoutique,
      statut: l.boutique.statutBoutique,
      monRole: l.roleBoutique,
    }));
  }

  // Sa boutique, ou 404 (on ne révèle pas l'existence de celle d'un autre).
  // Pour écrire, la boutique doit être vérifiée par KDExpress : sinon 403.
  async saBoutique(
    idUtilisateur: number,
    idBoutique: number,
    pourEcrire: boolean,
  ) {
    const lien = await this.prisma.gestionBoutique.findUnique({
      where: { idUtilisateur_idBoutique: { idUtilisateur, idBoutique } },
      include: { boutique: true },
    });
    if (!lien) {
      throw new NotFoundException(`Boutique ${idBoutique} introuvable`);
    }
    if (pourEcrire && lien.boutique.statutBoutique !== 'verifiee') {
      throw new ForbiddenException(
        'Votre boutique doit d’abord être vérifiée par KDExpress',
      );
    }
    return lien.boutique;
  }

  // POST /fournisseur/boutiques/:id/produits
  // Le prix client proposé = prix boutique + marge (paramètre), arrondi au dirham supérieur.
  // Le produit reste « propose » : la direction contrôle et publie.
  async proposer(
    idUtilisateur: number,
    idBoutique: number,
    dto: PropositionProduitDto,
  ) {
    await this.saBoutique(idUtilisateur, idBoutique, true);
    const marge = await this.margePourcentage();
    const prixBoutique = dto.variantes.map((v) =>
      montantPositif(v.prixBoutiqueAed, 'Le prix'),
    );
    const produit: CreerProduitDto = {
      nom: dto.nom,
      description: dto.description,
      idCategorie: dto.idCategorie,
      idMarque: dto.idMarque,
      caracteristiques: dto.caracteristiques,
      photos: dto.photos,
      variantes: dto.variantes.map((v, i) => ({
        libelle: v.libelle,
        prixCatalogueAed: prixAvecMarge(prixBoutique[i], marge).toFixed(2),
        poidsEstimeKg: v.poidsEstimeKg,
        options: v.options,
      })),
    };
    const cree = await this.produits.creer(produit, {
      idBoutique,
      prixBoutique,
    });
    return this.uneProposition(idBoutique, cree.idProduit);
  }

  // GET /fournisseur/boutiques/:id/produits
  async mesPropositions(idUtilisateur: number, idBoutique: number) {
    await this.saBoutique(idUtilisateur, idBoutique, false);
    const produits = await this.prisma.produit.findMany({
      where: { idBoutiqueOrigine: idBoutique },
      orderBy: { idProduit: 'desc' },
      include: INCLUSION_PROPOSITION(idBoutique),
    });
    return produits.map(presenterProposition);
  }

  // PATCH /fournisseur/boutiques/:id/produits/:idProduit : seulement tant qu'elle est « propose ».
  // Une fois publié, le produit appartient au catalogue de la direction.
  async modifierProposition(
    idUtilisateur: number,
    idBoutique: number,
    idProduit: number,
    dto: ModifierPropositionDto,
  ) {
    await this.saBoutique(idUtilisateur, idBoutique, true);
    const resultat = await this.prisma.produit.updateMany({
      where: {
        idProduit,
        idBoutiqueOrigine: idBoutique,
        statutProduit: 'propose',
      },
      data: { nomProduit: dto.nom, descriptionProduit: dto.description },
    });
    if (resultat.count === 0) {
      const produit = await this.prisma.produit.findFirst({
        where: { idProduit, idBoutiqueOrigine: idBoutique },
      });
      if (!produit) {
        throw new NotFoundException(`Produit ${idProduit} introuvable`);
      }
      throw new BadRequestException(
        `Un produit « ${produit.statutProduit} » n'est plus modifiable par la boutique`,
      );
    }
    return this.uneProposition(idBoutique, idProduit);
  }

  // GET /fournisseur/boutiques/:id/offres
  async mesOffres(idUtilisateur: number, idBoutique: number) {
    await this.saBoutique(idUtilisateur, idBoutique, false);
    return this.offres.lister(idBoutique);
  }

  // PUT /fournisseur/boutiques/:id/offres/:idVariante
  async enregistrerOffre(
    idUtilisateur: number,
    idBoutique: number,
    idVariante: number,
    dto: OffreDto,
  ) {
    await this.saBoutique(idUtilisateur, idBoutique, true);
    return this.offres.enregistrer(idBoutique, idVariante, dto);
  }

  // ------- outils internes -------

  private async uneProposition(idBoutique: number, idProduit: number) {
    const produit = await this.prisma.produit.findUniqueOrThrow({
      where: { idProduit },
      include: INCLUSION_PROPOSITION(idBoutique),
    });
    return presenterProposition(produit);
  }

  // Le paramètre « marge_catalogue_pourcentage » (20 par défaut)
  private async margePourcentage(): Promise<Prisma.Decimal> {
    const p = await this.prisma.parametre.findUnique({
      where: { codeParametre: 'marge_catalogue_pourcentage' },
    });
    const n = Number(p?.valeurParametre);
    return new Prisma.Decimal(Number.isFinite(n) && n >= 0 ? n : 20);
  }
}

// Ce que voit le fournisseur de ses propositions : le statut et SES prix
const INCLUSION_PROPOSITION = (idBoutique: number) =>
  ({
    categorie: { select: { nomCategorie: true } },
    variantes: {
      orderBy: { idVariante: 'asc' },
      include: { offres: { where: { idBoutique } } },
    },
  }) satisfies Prisma.ProduitInclude;

type Proposition = Prisma.ProduitGetPayload<{
  include: ReturnType<typeof INCLUSION_PROPOSITION>;
}>;

function presenterProposition(p: Proposition) {
  return {
    idProduit: p.idProduit,
    nom: p.nomProduit,
    description: p.descriptionProduit,
    categorie: p.categorie.nomCategorie,
    statut: p.statutProduit,
    variantes: p.variantes.map((v) => ({
      idVariante: v.idVariante,
      libelle: v.libelleVariante,
      monPrixAed: v.offres[0]?.prixBoutiqueAed.toFixed(2) ?? null,
      disponible: v.offres[0]?.estDisponible ?? false,
    })),
  };
}
