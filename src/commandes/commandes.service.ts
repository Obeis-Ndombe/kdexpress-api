import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import {
  genererCodeRetrait,
  numeroCommande,
  numeroProvisoire,
} from './codes.js';
import { DemandeCommandeDto } from './dto/demande-commande.dto.js';
import { Chiffrage, TarificationService } from './tarification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Decimal = Prisma.Decimal;

// Nombre d'essais si le code de retrait tiré existe déjà (très rare)
const ESSAIS_CODE_RETRAIT = 5;

// Nombre de commandes par page dans la liste
const PAR_PAGE = 20;

// Les rôles qui voient TOUTES les commandes
const PERSONNEL: RoleUtilisateur[] = [
  'agent_dubai',
  'agent_bureau',
  'direction',
];

// Les lignes d'une commande, avec les noms du produit et de la variante
const LIGNES = {
  orderBy: { idLigneCommande: 'asc' },
  include: {
    variante: {
      select: {
        libelleVariante: true,
        produit: { select: { nomProduit: true } },
      },
    },
  },
} satisfies Prisma.Commande$lignesArgs;

const CLIENT = {
  select: { idUtilisateur: true, nom: true, prenom: true },
} satisfies Prisma.UtilisateurDefaultArgs;

// Pour la liste : les lignes (pour le total) et seulement la DERNIÈRE étape franchie
const INCLUDE_LISTE = {
  lignes: LIGNES,
  client: CLIENT,
  historique: {
    orderBy: { etape: { ordreEtape: 'desc' } },
    take: 1,
    include: { etape: true },
  },
} satisfies Prisma.CommandeInclude;

// Pour le détail : les lignes et TOUT l'historique, dans l'ordre
const INCLUDE_DETAIL = {
  lignes: LIGNES,
  client: CLIENT,
  historique: {
    orderBy: { etape: { ordreEtape: 'asc' } },
    include: { etape: true },
  },
} satisfies Prisma.CommandeInclude;

// Une commande enregistrée avec ses lignes (le type est déduit de LIGNES par Prisma)
type CommandeAvecLignes = Prisma.CommandeGetPayload<{
  include: { lignes: typeof LIGNES };
}>;

@Injectable()
export class CommandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tarification: TarificationService,
  ) {}

  // POST /commandes/devis : ce que coûterait ce panier, sans rien enregistrer
  async devis(dto: DemandeCommandeDto) {
    const chiffrage = await this.tarification.chiffrer(dto.lignes);
    return this.presenter(chiffrage);
  }

  // POST /commandes : le panier devient une vraie commande, aux prix figés
  async creer(dto: DemandeCommandeDto, idClient: number) {
    // 1. le même calcul que le devis : le client paie ce qu'on lui a annoncé
    const chiffrage = await this.tarification.chiffrer(dto.lignes);

    // la 1re étape du suivi : « En attente de paiement »
    const premiereEtape = await this.prisma.etapeCommande.findFirst({
      where: { ordreEtape: 1 },
    });
    if (!premiereEtape) {
      throw new InternalServerErrorException(
        'Étape de commande n°1 absente de la table etape_commande',
      );
    }

    // si le code de retrait tiré existe déjà, la base refuse (P2002) et on recommence
    for (let essai = 1; essai <= ESSAIS_CODE_RETRAIT; essai++) {
      try {
        const commande = await this.enregistrer(
          chiffrage,
          idClient,
          premiereEtape.idEtapeCommande,
        );
        return {
          idCommande: commande.idCommande,
          numeroCommande: commande.numeroCommande,
          codeRetrait: commande.codeRetrait,
          dateCommande: commande.dateCommande,
          etape: premiereEtape.libelleEtape,
          ...this.presenter(chiffrage),
        };
      } catch (erreur) {
        const doublon =
          erreur instanceof Prisma.PrismaClientKnownRequestError &&
          erreur.code === 'P2002';
        if (!doublon || essai === ESSAIS_CODE_RETRAIT) {
          throw erreur;
        }
      }
    }
    throw new InternalServerErrorException(
      'Création de la commande impossible',
    );
  }

  // GET /commandes : les commandes visibles par cet utilisateur, 20 par page
  async lister(utilisateur: UtilisateurConnecte, page = 1, idClient?: number) {
    if (page < 1) {
      throw new BadRequestException('La page commence à 1');
    }
    const where = this.visibles(utilisateur, idClient);
    const personnel = this.estPersonnel(utilisateur);

    // deux lectures dans la même transaction : le total et la page demandée
    const [total, commandes] = await this.prisma.$transaction([
      this.prisma.commande.count({ where }),
      this.prisma.commande.findMany({
        where,
        orderBy: { idCommande: 'desc' }, // la plus récente d'abord
        skip: (page - 1) * PAR_PAGE,
        take: PAR_PAGE,
        include: INCLUDE_LISTE,
      }),
    ]);

    return {
      page,
      parPage: PAR_PAGE,
      total,
      pages: Math.ceil(total / PAR_PAGE),
      commandes: commandes.map((c) => ({
        idCommande: c.idCommande,
        numeroCommande: c.numeroCommande,
        dateCommande: c.dateCommande,
        ...(personnel ? { client: c.client } : {}),
        etape: c.historique[0]?.etape.libelleEtape ?? null,
        nombreArticles: c.lignes.reduce((n, l) => n + l.quantite, 0),
        totalUsd: this.presenter(this.chiffrageEnregistre(c)).totalUsd,
      })),
    };
  }

  // GET /commandes/:id : le détail, si l'utilisateur a le droit de la voir
  async detail(idCommande: number, utilisateur: UtilisateurConnecte) {
    const c = await this.prisma.commande.findFirst({
      where: { idCommande, ...this.visibles(utilisateur) },
      include: INCLUDE_DETAIL,
    });

    // la commande d'un autre client : « introuvable », comme si elle n'existait pas
    if (!c) {
      throw new NotFoundException(`Commande ${idCommande} introuvable`);
    }

    const montants = this.presenter(this.chiffrageEnregistre(c));
    const historique = c.historique.map((h) => ({
      etape: h.etape.libelleEtape,
      ordre: h.etape.ordreEtape,
      date: h.dateFranchissement,
      commentaire: h.commentaireEtape,
    }));

    return {
      idCommande: c.idCommande,
      numeroCommande: c.numeroCommande,
      dateCommande: c.dateCommande,
      // le personnel voit le client ; seul le client voit son code de retrait
      ...(this.estPersonnel(utilisateur)
        ? { client: c.client }
        : { codeRetrait: c.codeRetrait }),
      etape: historique.at(-1)?.etape ?? null,
      historique,
      ...montants,
      // chaque ligne garde aussi son id et son statut (à acheter, achetée…)
      lignes: montants.lignes.map((l, i) => ({
        idLigneCommande: c.lignes[i].idLigneCommande,
        ...l,
        statut: c.lignes[i].statutLigneCommande,
      })),
    };
  }

  // ------- outils internes -------

  private estPersonnel(utilisateur: UtilisateurConnecte): boolean {
    return PERSONNEL.includes(utilisateur.role);
  }

  // LA règle « qui voit quoi », utilisée par la liste ET le détail
  private visibles(
    utilisateur: UtilisateurConnecte,
    idClient?: number,
  ): Prisma.CommandeWhereInput {
    if (this.estPersonnel(utilisateur)) {
      return idClient ? { idClient } : {}; // tout, ou un client précis
    }
    return { idClient: utilisateur.idUtilisateur }; // un client : seulement les siennes
  }

  // Refait le chiffrage à partir des valeurs FIGÉES dans la commande (pas du catalogue)
  private chiffrageEnregistre(c: CommandeAvecLignes): Chiffrage {
    const lignes = c.lignes.map((l) => ({
      idVariante: l.idVariante,
      produit: l.variante.produit.nomProduit,
      variante: l.variante.libelleVariante,
      quantite: l.quantite,
      prixUnitaireAed: l.prixUnitaireAed,
      poidsUnitaireKg: l.poidsUnitaireKg,
      sousTotalAed: l.prixUnitaireAed.mul(l.quantite),
    }));
    const articlesAed = lignes.reduce(
      (total, l) => total.add(l.sousTotalAed),
      new Prisma.Decimal(0),
    );

    return {
      tauxChangeAedUsd: c.tauxChangeAedUsd,
      lignes,
      articlesAed,
      articlesUsd: articlesAed.mul(c.tauxChangeAedUsd).toDecimalPlaces(2),
      poidsTotalKg: lignes.reduce(
        (total, l) => total.add(l.poidsUnitaireKg.mul(l.quantite)),
        new Prisma.Decimal(0),
      ),
      fraisTransportUsd: c.fraisTransportUsd,
      fraisServiceUsd: c.fraisServiceUsd,
    };
  }

  // Toutes les écritures d'une commande, dans UNE transaction : tout ou rien
  private enregistrer(c: Chiffrage, idClient: number, idPremiereEtape: number) {
    return this.prisma.$transaction(async (tx) => {
      // 2. la commande, avec le taux et les frais de ce jour-là
      const brouillon = await tx.commande.create({
        data: {
          numeroCommande: numeroProvisoire(),
          codeRetrait: genererCodeRetrait(),
          tauxChangeAedUsd: c.tauxChangeAedUsd,
          fraisTransportUsd: c.fraisTransportUsd,
          fraisServiceUsd: c.fraisServiceUsd,
          idClient,
        },
      });

      // 3. le vrai numéro, maintenant que l'id est connu
      const commande = await tx.commande.update({
        where: { idCommande: brouillon.idCommande },
        data: {
          numeroCommande: numeroCommande(
            brouillon.dateCommande.getFullYear(),
            brouillon.idCommande,
          ),
        },
      });

      // 5. les lignes, prix et poids figés (la « photo » du jour)
      await tx.ligneCommande.createMany({
        data: c.lignes.map((l) => ({
          idCommande: commande.idCommande,
          idVariante: l.idVariante,
          quantite: l.quantite,
          prixUnitaireAed: l.prixUnitaireAed,
          poidsUnitaireKg: l.poidsUnitaireKg,
        })),
      });

      // 6. la première étape du suivi
      await tx.historiqueCommande.create({
        data: {
          idCommande: commande.idCommande,
          idEtapeCommande: idPremiereEtape,
        },
      });

      return commande;
    });
  }

  // Met le chiffrage en forme pour le client : textes à 2 décimales, AED et USD
  private presenter(c: Chiffrage) {
    const usd = (aed: Decimal) => aed.mul(c.tauxChangeAedUsd).toFixed(2);
    const aPayerMaintenant = c.articlesUsd.add(c.fraisTransportUsd);

    return {
      tauxChangeAedUsd: c.tauxChangeAedUsd.toString(),
      lignes: c.lignes.map((l) => ({
        idVariante: l.idVariante,
        produit: l.produit,
        variante: l.variante,
        quantite: l.quantite,
        prixUnitaire: {
          aed: l.prixUnitaireAed.toFixed(2),
          usd: usd(l.prixUnitaireAed),
        },
        sousTotal: { aed: l.sousTotalAed.toFixed(2), usd: usd(l.sousTotalAed) },
      })),
      poidsEstimeKg: c.poidsTotalKg.toFixed(3),
      articles: {
        aed: c.articlesAed.toFixed(2),
        usd: c.articlesUsd.toFixed(2),
      },
      fraisTransportUsd: c.fraisTransportUsd.toFixed(2),
      fraisServiceUsd: c.fraisServiceUsd.toFixed(2),
      aPayerALaCommandeUsd: aPayerMaintenant.toFixed(2), // articles + transport
      aPayerAuRetraitUsd: c.fraisServiceUsd.toFixed(2), // frais de service
      totalUsd: aPayerMaintenant.add(c.fraisServiceUsd).toFixed(2),
    };
  }
}
