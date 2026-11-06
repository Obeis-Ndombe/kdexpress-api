import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutLigneCommande } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { AvoirsService } from '../avoirs/avoirs.service.js';
import { franchirEtape } from '../commandes/avancement.js';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { articlesEnUsd } from '../commandes/montants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnregistrerAchatDto } from './dto/enregistrer-achat.dto.js';

type Tx = Prisma.TransactionClient;

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// Une commande dont les lignes peuvent être achetées : payée, et pas annulée
const COMMANDE_A_ACHETER = {
  historique: { some: { etape: { ordreEtape: ORDRE_ETAPE.PAYEE } } },
  NOT: { historique: { some: { etape: { ordreEtape: ORDRE_ETAPE.ANNULEE } } } },
} satisfies Prisma.CommandeWhereInput;

// Une ligne est « traitée » quand elle n'attend plus d'achat
const TRAITEE: StatutLigneCommande[] = ['achetee', 'introuvable', 'remboursee'];

@Injectable()
export class AchatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avoirs: AvoirsService,
  ) {}

  // GET /achats/a-faire : la liste d'achats, regroupée par article
  async aFaire() {
    const [lignes, delai] = await Promise.all([
      this.prisma.ligneCommande.findMany({
        where: {
          statutLigneCommande: 'a_acheter',
          commande: COMMANDE_A_ACHETER,
        },
        orderBy: { idLigneCommande: 'asc' },
        include: {
          variante: {
            include: {
              produit: { select: { nomProduit: true } },
              offres: {
                where: { estDisponible: true },
                orderBy: { prixBoutiqueAed: 'asc' }, // la moins chère d'abord
                include: {
                  boutique: {
                    select: { nomBoutique: true, statutBoutique: true },
                  },
                },
              },
            },
          },
          commande: {
            select: {
              numeroCommande: true,
              // la date à laquelle la commande est devenue « Payée »
              historique: {
                where: { etape: { ordreEtape: ORDRE_ETAPE.PAYEE } },
                select: { dateFranchissement: true },
              },
            },
          },
        },
      }),
      this.delaiAlerteJours(),
    ]);

    // regroupement par variante : « Oud Royal 100 ml : 15 au total »
    const parArticle = new Map<number, (typeof lignes)[number][]>();
    for (const ligne of lignes) {
      const groupe = parArticle.get(ligne.idVariante) ?? [];
      groupe.push(ligne);
      parArticle.set(ligne.idVariante, groupe);
    }

    const maintenant = Date.now();
    const articles = [...parArticle.values()].map((groupe) => {
      const { variante } = groupe[0];
      const commandes = groupe.map((l) => {
        const payeeLe = l.commande.historique[0]?.dateFranchissement ?? null;
        return {
          idLigneCommande: l.idLigneCommande,
          numeroCommande: l.commande.numeroCommande,
          quantite: l.quantite,
          payeeLe,
          attenteJours: payeeLe
            ? Math.floor((maintenant - payeeLe.getTime()) / UN_JOUR_MS)
            : 0,
        };
      });
      const attenteJours = Math.max(...commandes.map((c) => c.attenteJours));
      return {
        idVariante: variante.idVariante,
        produit: variante.produit.nomProduit,
        variante: variante.libelleVariante,
        quantiteTotale: commandes.reduce((n, c) => n + c.quantite, 0),
        attenteJours,
        alerte: attenteJours > delai,
        commandes,
        boutiques: variante.offres.map((o) => ({
          idBoutique: o.idBoutique,
          nom: o.boutique.nomBoutique,
          statut: o.boutique.statutBoutique,
          prixAed: o.prixBoutiqueAed.toFixed(2),
        })),
      };
    });

    // ce qui attend depuis le plus longtemps en premier
    articles.sort((a, b) => b.attenteJours - a.attenteJours);
    return { delaiAlerteJours: delai, articles };
  }

  // POST /achats : l'agent a payé des articles dans une boutique
  async acheter(dto: EnregistrerAchatDto, agent: UtilisateurConnecte) {
    const ids = dto.lignes.map((l) => l.idLigneCommande);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Une même ligne apparaît deux fois');
    }

    const boutique = await this.prisma.boutique.findUnique({
      where: { idBoutique: dto.idBoutique },
    });
    if (!boutique) {
      throw new NotFoundException(`Boutique ${dto.idBoutique} introuvable`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. chaque ligne doit attendre un achat, dans une commande payée
      const lignes = await this.lignesAAcheter(tx, ids);

      // 2. l'achat
      const achat = await tx.achatBoutique.create({
        data: { idBoutique: dto.idBoutique, idAgentAchat: agent.idUtilisateur },
      });

      // 3. chaque ligne passe à « achetée », avec son prix réel
      for (const l of dto.lignes) {
        await this.changerStatut(tx, l.idLigneCommande, 'a_acheter', {
          statutLigneCommande: 'achetee',
          idAchatBoutique: achat.idAchatBoutique,
          prixAchatReelAed: new Prisma.Decimal(l.prixAchatReelAed),
        });
      }

      // 4. les commandes touchées avancent
      const commandes = await this.avancer(
        tx,
        lignes.map((l) => l.idCommande),
      );

      return {
        idAchatBoutique: achat.idAchatBoutique,
        date: achat.dateAchat,
        boutique: boutique.nomBoutique,
        lignes: dto.lignes.map((l) => {
          const ligne = lignes.find(
            (x) => x.idLigneCommande === l.idLigneCommande,
          )!;
          return {
            idLigneCommande: l.idLigneCommande,
            numeroCommande: ligne.commande.numeroCommande,
            quantite: ligne.quantite,
            prixClientAed: ligne.prixUnitaireAed.toFixed(2),
            prixAchatReelAed: new Prisma.Decimal(l.prixAchatReelAed).toFixed(2),
          };
        }),
        commandes,
      };
    });
  }

  // POST /achats/lignes/:id/introuvable : l'agent ne trouve l'article nulle part
  async introuvable(idLigneCommande: number) {
    return this.prisma.$transaction(async (tx) => {
      const [ligne] = await this.lignesAAcheter(tx, [idLigneCommande]);
      await this.changerStatut(tx, idLigneCommande, 'a_acheter', {
        statutLigneCommande: 'introuvable',
      });
      const commandes = await this.avancer(tx, [ligne.idCommande]);
      return {
        idLigneCommande,
        numeroCommande: ligne.commande.numeroCommande,
        statut: 'introuvable',
        commandes,
      };
    });
  }

  // POST /achats/lignes/:id/rembourser : la direction rembourse un article introuvable par un avoir
  async rembourser(idLigneCommande: number) {
    return this.prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCommande.findUnique({
        where: { idLigneCommande },
        include: {
          variante: {
            select: {
              libelleVariante: true,
              produit: { select: { nomProduit: true } },
            },
          },
          commande: {
            include: {
              lignes: { select: { prixUnitaireAed: true, quantite: true } },
            },
          },
        },
      });
      if (!ligne) {
        throw new NotFoundException(`Ligne ${idLigneCommande} introuvable`);
      }
      if (ligne.statutLigneCommande !== 'introuvable') {
        throw new BadRequestException(
          `Seule une ligne « introuvable » se rembourse (statut actuel : ${ligne.statutLigneCommande})`,
        );
      }

      // le montant : l'article au taux figé, plus sa part du transport payé
      const c = ligne.commande;
      const articleUsd = ligne.prixUnitaireAed
        .mul(ligne.quantite)
        .mul(c.tauxChangeAedUsd)
        .toDecimalPlaces(2);
      const totalArticlesUsd = articlesEnUsd(c);
      const transportUsd = totalArticlesUsd.isZero()
        ? new Prisma.Decimal(0)
        : c.fraisTransportUsd
            .mul(articleUsd)
            .div(totalArticlesUsd)
            .toDecimalPlaces(2);
      const montant = articleUsd.add(transportUsd);

      // « introuvable » → « remboursée » une seule fois, même si deux personnes cliquent ensemble
      await this.changerStatut(tx, idLigneCommande, 'introuvable', {
        statutLigneCommande: 'remboursee',
      });

      const motif = `${ligne.variante.produit.nomProduit} ${ligne.variante.libelleVariante} introuvable – ${c.numeroCommande}`;
      await this.avoirs.ajouterCredit(
        c.idClient,
        montant,
        motif.slice(0, 255),
        c.idCommande,
        tx,
      );

      return {
        idLigneCommande,
        numeroCommande: c.numeroCommande,
        statut: 'remboursee',
        avoir: {
          articleUsd: articleUsd.toFixed(2),
          transportUsd: transportUsd.toFixed(2),
          totalUsd: montant.toFixed(2),
          motif,
        },
        soldeAvoirUsd: (await this.avoirs.solde(c.idClient, tx)).toFixed(2),
      };
    });
  }

  // ------- outils internes -------

  // Charge les lignes et vérifie qu'elles attendent un achat dans une commande payée
  private async lignesAAcheter(tx: Tx, ids: number[]) {
    const lignes = await tx.ligneCommande.findMany({
      where: { idLigneCommande: { in: ids } },
      include: {
        commande: {
          select: {
            numeroCommande: true,
            historique: { select: { etape: { select: { ordreEtape: true } } } },
          },
        },
      },
    });

    for (const id of ids) {
      const ligne = lignes.find((l) => l.idLigneCommande === id);
      if (!ligne) {
        throw new NotFoundException(`Ligne ${id} introuvable`);
      }
      const ordres = ligne.commande.historique.map((h) => h.etape.ordreEtape);
      if (ordres.includes(ORDRE_ETAPE.ANNULEE)) {
        throw new BadRequestException(
          `La commande ${ligne.commande.numeroCommande} est annulée`,
        );
      }
      if (!ordres.includes(ORDRE_ETAPE.PAYEE)) {
        throw new BadRequestException(
          `La commande ${ligne.commande.numeroCommande} n'est pas encore payée`,
        );
      }
      if (ligne.statutLigneCommande !== 'a_acheter') {
        throw new BadRequestException(
          `La ligne ${id} n'est plus à acheter (statut : ${ligne.statutLigneCommande})`,
        );
      }
    }
    return lignes;
  }

  // Change le statut d'une ligne SEULEMENT si elle a encore le statut attendu.
  // Si un autre agent l'a changé entre-temps, rien n'est modifié : on le signale.
  private async changerStatut(
    tx: Tx,
    idLigneCommande: number,
    statutAttendu: StatutLigneCommande,
    data: Prisma.LigneCommandeUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.ligneCommande.updateMany({
      where: { idLigneCommande, statutLigneCommande: statutAttendu },
      data,
    });
    if (count === 0) {
      throw new ConflictException(
        `La ligne ${idLigneCommande} vient d'être traitée par quelqu'un d'autre`,
      );
    }
  }

  // Fait avancer les commandes : « Achat en cours » dès un achat, « Achetée » quand tout est traité
  private async avancer(tx: Tx, idsCommandes: number[]) {
    const resultats: { numeroCommande: string; etapesFranchies: string[] }[] =
      [];

    for (const idCommande of new Set(idsCommandes)) {
      const commande = await tx.commande.findUniqueOrThrow({
        where: { idCommande },
        select: {
          numeroCommande: true,
          lignes: { select: { statutLigneCommande: true } },
        },
      });
      const statuts = commande.lignes.map((l) => l.statutLigneCommande);
      const etapesFranchies: string[] = [];

      if (statuts.includes('achetee')) {
        const e = await franchirEtape(
          tx,
          idCommande,
          ORDRE_ETAPE.ACHAT_EN_COURS,
        );
        if (e) etapesFranchies.push(e);
      }
      if (statuts.every((s) => TRAITEE.includes(s))) {
        const rien = !statuts.includes('achetee');
        const e = await franchirEtape(
          tx,
          idCommande,
          ORDRE_ETAPE.ACHETEE,
          rien ? 'Aucun article trouvé à Dubaï' : undefined,
        );
        if (e) etapesFranchies.push(e);
      }
      resultats.push({
        numeroCommande: commande.numeroCommande,
        etapesFranchies,
      });
    }
    return resultats;
  }

  // Le paramètre « delai_alerte_achat_jours » (3 par défaut)
  private async delaiAlerteJours(): Promise<number> {
    const p = await this.prisma.parametre.findUnique({
      where: { codeParametre: 'delai_alerte_achat_jours' },
    });
    const n = Number(p?.valeurParametre);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }
}
