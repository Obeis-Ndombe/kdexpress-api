import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DefinirCaracteristiquesCategorieDto,
  CreerCategorieDto,
  ModifierCategorieDto,
} from './dto/categorie.dto.js';
import {
  CreerCaracteristiqueDto,
  CreerMarqueDto,
} from './dto/marque-caracteristique.dto.js';
import { estErreurPrisma, montantPositif } from './regles-catalogue.js';

const INCLUSION_CATEGORIE = {
  caracteristiques: {
    include: { caracteristique: true },
    orderBy: { idCaracteristique: 'asc' },
  },
} satisfies Prisma.CategorieInclude;

type CategorieComplete = Prisma.CategorieGetPayload<{
  include: typeof INCLUSION_CATEGORIE;
}>;

// Les listes de base : catégories, marques, caractéristiques
@Injectable()
export class ReferentielService {
  constructor(private readonly prisma: PrismaService) {}

  // ------- catégories -------

  async listerCategories() {
    const categories = await this.prisma.categorie.findMany({
      include: INCLUSION_CATEGORIE,
      orderBy: { nomCategorie: 'asc' },
    });
    return categories.map((c) => this.presenterCategorie(c));
  }

  async creerCategorie(dto: CreerCategorieDto) {
    const poids = montantPositif(dto.poidsParDefautKg, 'Le poids par défaut');
    try {
      const categorie = await this.prisma.categorie.create({
        data: { nomCategorie: dto.nom, poidsParDefautKg: poids },
        include: INCLUSION_CATEGORIE,
      });
      return this.presenterCategorie(categorie);
    } catch (erreur) {
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(`La catégorie « ${dto.nom} » existe déjà`);
      }
      throw erreur;
    }
  }

  async modifierCategorie(idCategorie: number, dto: ModifierCategorieDto) {
    const poids =
      dto.poidsParDefautKg === undefined
        ? undefined
        : montantPositif(dto.poidsParDefautKg, 'Le poids par défaut');
    try {
      const categorie = await this.prisma.categorie.update({
        where: { idCategorie },
        data: { nomCategorie: dto.nom, poidsParDefautKg: poids },
        include: INCLUSION_CATEGORIE,
      });
      return this.presenterCategorie(categorie);
    } catch (erreur) {
      if (estErreurPrisma(erreur, 'P2025')) {
        throw new NotFoundException(`Catégorie ${idCategorie} introuvable`);
      }
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(`La catégorie « ${dto.nom} » existe déjà`);
      }
      throw erreur;
    }
  }

  // La liste reçue remplace l'ancienne, en une seule transaction.
  // Les produits déjà créés ne changent pas : la règle ne joue qu'à l'écriture.
  async definirCaracteristiques(
    idCategorie: number,
    dto: DefinirCaracteristiquesCategorieDto,
  ) {
    const ids = dto.caracteristiques.map((c) => c.idCaracteristique);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Une même caractéristique est donnée plusieurs fois',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const categorie = await tx.categorie.findUnique({
        where: { idCategorie },
      });
      if (!categorie) {
        throw new NotFoundException(`Catégorie ${idCategorie} introuvable`);
      }
      const existantes = await tx.caracteristique.count({
        where: { idCaracteristique: { in: ids } },
      });
      if (existantes !== ids.length) {
        throw new BadRequestException('Une caractéristique est inconnue');
      }
      await tx.caracteristiqueCategorie.deleteMany({ where: { idCategorie } });
      await tx.caracteristiqueCategorie.createMany({
        data: dto.caracteristiques.map((c) => ({
          idCategorie,
          idCaracteristique: c.idCaracteristique,
          usageCaracteristique: c.usage,
        })),
      });
      const complete = await tx.categorie.findUniqueOrThrow({
        where: { idCategorie },
        include: INCLUSION_CATEGORIE,
      });
      return this.presenterCategorie(complete);
    });
  }

  // ------- marques -------

  async listerMarques() {
    const marques = await this.prisma.marque.findMany({
      orderBy: { nomMarque: 'asc' },
    });
    return marques.map((m) => ({ idMarque: m.idMarque, nom: m.nomMarque }));
  }

  async creerMarque(dto: CreerMarqueDto) {
    try {
      const marque = await this.prisma.marque.create({
        data: { nomMarque: dto.nom },
      });
      return { idMarque: marque.idMarque, nom: marque.nomMarque };
    } catch (erreur) {
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(`La marque « ${dto.nom} » existe déjà`);
      }
      throw erreur;
    }
  }

  // ------- caractéristiques -------

  async listerCaracteristiques() {
    const liste = await this.prisma.caracteristique.findMany({
      orderBy: { nomCaracteristique: 'asc' },
    });
    return liste.map((c) => this.presenterCaracteristique(c));
  }

  async creerCaracteristique(dto: CreerCaracteristiqueDto) {
    try {
      const caracteristique = await this.prisma.caracteristique.create({
        data: { nomCaracteristique: dto.nom, uniteMesure: dto.unite },
      });
      return this.presenterCaracteristique(caracteristique);
    } catch (erreur) {
      if (estErreurPrisma(erreur, 'P2002')) {
        throw new ConflictException(
          `La caractéristique « ${dto.nom} » existe déjà`,
        );
      }
      throw erreur;
    }
  }

  // ------- présentation -------

  private presenterCaracteristique(c: {
    idCaracteristique: number;
    nomCaracteristique: string;
    uniteMesure: string | null;
  }) {
    return {
      idCaracteristique: c.idCaracteristique,
      nom: c.nomCaracteristique,
      unite: c.uniteMesure,
    };
  }

  private presenterCategorie(c: CategorieComplete) {
    return {
      idCategorie: c.idCategorie,
      nom: c.nomCategorie,
      poidsParDefautKg: c.poidsParDefautKg.toFixed(3),
      caracteristiques: c.caracteristiques.map((cc) => ({
        ...this.presenterCaracteristique(cc.caracteristique),
        usage: cc.usageCaracteristique,
      })),
    };
  }
}
