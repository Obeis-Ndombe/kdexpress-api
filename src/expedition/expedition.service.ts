import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutColis } from '@prisma/client';
import { franchirEtape } from '../commandes/avancement.js';
import { numeroProvisoire } from '../commandes/codes.js';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { avecEssais, SERIALISABLE } from '../commun/transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreerColisDto } from './dto/creer-colis.dto.js';
import { ArriveeLotDto, DepartLotDto } from './dto/lot.dto.js';

type Tx = Prisma.TransactionClient;

// Les lignes achetées d'une commande, avec ce qui est déjà mis en colis
const LIGNES_ACHETEES = {
  where: { statutLigneCommande: 'achetee' },
  orderBy: { idLigneCommande: 'asc' },
  include: {
    contenuColis: { select: { quantiteEmballee: true } },
    variante: {
      select: {
        libelleVariante: true,
        produit: { select: { nomProduit: true } },
      },
    },
  },
} satisfies Prisma.Commande$lignesArgs;

type LigneAchetee = Prisma.LigneCommandeGetPayload<{
  include: (typeof LIGNES_ACHETEES)['include'];
}>;

// Combien il reste à emballer d'une ligne achetée
function resteAEmballer(ligne: LigneAchetee): number {
  const emballe = ligne.contenuColis.reduce(
    (n, c) => n + c.quantiteEmballee,
    0,
  );
  return ligne.quantite - emballe;
}

// Une commande dont les articles sont achetés, et qui n'est pas annulée
const COMMANDE_ACHETEE = {
  historique: { some: { etape: { ordreEtape: ORDRE_ETAPE.ACHETEE } } },
  NOT: { historique: { some: { etape: { ordreEtape: ORDRE_ETAPE.ANNULEE } } } },
} satisfies Prisma.CommandeWhereInput;

// Les statuts d'un colis qui a quitté Dubaï
const PARTI: StatutColis[] = ['expedie', 'arrive', 'remis'];

@Injectable()
export class ExpeditionService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================= colis =========================

  // GET /expedition/a-emballer : les commandes achetées qui ont encore des articles à emballer
  async aEmballer() {
    const commandes = await this.prisma.commande.findMany({
      where: {
        ...COMMANDE_ACHETEE,
        lignes: { some: { statutLigneCommande: 'achetee' } },
      },
      orderBy: { idCommande: 'asc' },
      include: {
        client: { select: { nom: true, prenom: true } },
        lignes: LIGNES_ACHETEES,
        colis: { select: { idColis: true, statutColis: true } },
      },
    });

    return commandes
      .map((c) => ({
        idCommande: c.idCommande,
        numeroCommande: c.numeroCommande,
        client: `${c.client.prenom} ${c.client.nom}`,
        colisDejaPrepares: c.colis.length,
        lignes: c.lignes
          .map((l) => ({
            idLigneCommande: l.idLigneCommande,
            produit: l.variante.produit.nomProduit,
            variante: l.variante.libelleVariante,
            quantite: l.quantite,
            resteAEmballer: resteAEmballer(l),
          }))
          .filter((l) => l.resteAEmballer > 0),
      }))
      .filter((c) => c.lignes.length > 0);
  }

  // POST /colis : un carton pour une commande
  creerColis(dto: CreerColisDto) {
    const ids = dto.contenu.map((c) => c.idLigneCommande);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Une même ligne apparaît deux fois dans le colis',
      );
    }

    // sérialisable : deux agents qui emballent la même ligne en même temps ne dépassent pas la quantité
    return avecEssais(
      () =>
        this.prisma.$transaction(async (tx) => {
          const commande = await tx.commande.findFirst({
            where: { idCommande: dto.idCommande, ...COMMANDE_ACHETEE },
            include: { lignes: LIGNES_ACHETEES },
          });
          if (!commande) {
            throw new BadRequestException(
              `La commande ${dto.idCommande} n'existe pas, n'est pas encore achetée, ou est annulée`,
            );
          }

          for (const c of dto.contenu) {
            const ligne = commande.lignes.find(
              (l) => l.idLigneCommande === c.idLigneCommande,
            );
            if (!ligne) {
              throw new BadRequestException(
                `La ligne ${c.idLigneCommande} n'est pas une ligne achetée de la commande ${commande.numeroCommande}`,
              );
            }
            const reste = resteAEmballer(ligne);
            if (c.quantite > reste) {
              throw new BadRequestException(
                `Ligne ${c.idLigneCommande} : il reste ${reste} à emballer, pas ${c.quantite}`,
              );
            }
          }

          const colis = await tx.colis.create({
            data: {
              idCommande: dto.idCommande,
              poidsReelKg: dto.poidsReelKg
                ? new Prisma.Decimal(dto.poidsReelKg)
                : undefined,
              contenu: {
                create: dto.contenu.map((c) => ({
                  idLigneCommande: c.idLigneCommande,
                  quantiteEmballee: c.quantite,
                })),
              },
            },
          });

          return {
            ...(await this.presenterColis(tx, colis.idColis)),
            numeroCommande: commande.numeroCommande,
          };
        }, SERIALISABLE),
      'Colis en conflit avec un autre, réessayez',
    );
  }

  // PATCH /colis/:id : le poids réel, tant que le colis n'est pas parti
  async peser(idColis: number, poidsReelKg: string) {
    const { count } = await this.prisma.colis.updateMany({
      where: { idColis, statutColis: 'prepare' },
      data: { poidsReelKg: new Prisma.Decimal(poidsReelKg) },
    });
    if (count === 0) {
      await this.colisOuErreur(idColis);
      throw new BadRequestException(`Le colis ${idColis} est déjà parti`);
    }
    return this.presenterColis(this.prisma, idColis);
  }

  // POST /colis/:id/pointage : le bureau de Kinshasa a reçu ce colis
  pointer(idColis: number) {
    return this.prisma.$transaction(async (tx) => {
      const colis = await tx.colis.findUnique({
        where: { idColis },
        include: {
          lotExpedition: { select: { statutLot: true, referenceLot: true } },
        },
      });
      if (!colis) {
        throw new NotFoundException(`Colis ${idColis} introuvable`);
      }
      if (colis.lotExpedition?.statutLot !== 'arrive') {
        throw new BadRequestException(
          `Le colis ${idColis} n'est pas dans un lot arrivé à Kinshasa`,
        );
      }

      // « expédié » → « arrivé », une seule fois
      const { count } = await tx.colis.updateMany({
        where: { idColis, statutColis: 'expedie' },
        data: { statutColis: 'arrive' },
      });
      if (count === 0) {
        throw new BadRequestException(
          `Le colis ${idColis} est déjà pointé (statut : ${colis.statutColis})`,
        );
      }

      // tous les colis de la commande sont au bureau : « Prête au retrait »
      const statuts = await tx.colis.findMany({
        where: { idCommande: colis.idCommande },
        select: { statutColis: true },
      });
      const tousArrives = statuts.every(
        (c) => c.statutColis === 'arrive' || c.statutColis === 'remis',
      );
      const etapeFranchie = tousArrives
        ? await franchirEtape(
            tx,
            colis.idCommande,
            ORDRE_ETAPE.PRETE_AU_RETRAIT,
          )
        : null;

      const commande = await tx.commande.findUniqueOrThrow({
        where: { idCommande: colis.idCommande },
        select: { numeroCommande: true },
      });
      return {
        idColis,
        statut: 'arrive',
        numeroCommande: commande.numeroCommande,
        colisRestantsAPointer: statuts.filter(
          (c) => c.statutColis === 'expedie',
        ).length,
        etapeFranchie,
      };
    });
  }

  // ========================= lots =========================

  // POST /lots : une palette pour une agence de transport
  async creerLot(idAgenceTransport: number, idsColis: number[]) {
    const agence = await this.prisma.agenceTransport.findUnique({
      where: { idAgenceTransport },
    });
    if (!agence) {
      throw new NotFoundException(`Agence ${idAgenceTransport} introuvable`);
    }

    const idLot = await this.prisma.$transaction(async (tx) => {
      // le numéro lisible dépend de l'id : provisoire, puis le vrai, dans la même transaction
      const brouillon = await tx.lotExpedition.create({
        data: { idAgenceTransport, referenceLot: numeroProvisoire() },
      });
      await tx.lotExpedition.update({
        where: { idLotExpedition: brouillon.idLotExpedition },
        data: {
          referenceLot: `LOT-${new Date().getFullYear()}-${String(brouillon.idLotExpedition).padStart(4, '0')}`,
        },
      });
      await this.mettreDansLeLot(tx, brouillon.idLotExpedition, idsColis);
      return brouillon.idLotExpedition;
    });
    return this.detailLot(idLot);
  }

  // POST /lots/:id/colis
  async ajouterAuLot(idLot: number, idsColis: number[]) {
    await this.prisma.$transaction(async (tx) => {
      const lot = await this.lotOuErreur(tx, idLot);
      if (lot.statutLot !== 'en_preparation') {
        throw new BadRequestException(
          `Le lot ${lot.referenceLot} est déjà parti`,
        );
      }
      await this.mettreDansLeLot(tx, idLot, idsColis);
    });
    return this.detailLot(idLot);
  }

  // POST /lots/:id/depart : le lot quitte Dubaï
  async depart(idLot: number, dto: DepartLotDto) {
    const etapes = await this.prisma.$transaction(async (tx) => {
      const lot = await this.lotOuErreur(tx, idLot);
      const nbColis = await tx.colis.count({
        where: { idLotExpedition: idLot },
      });
      if (nbColis === 0) {
        throw new BadRequestException(`Le lot ${lot.referenceLot} est vide`);
      }

      // « en préparation » → « parti », une seule fois
      const { count } = await tx.lotExpedition.updateMany({
        where: { idLotExpedition: idLot, statutLot: 'en_preparation' },
        data: {
          statutLot: 'parti',
          dateDepart: dto.dateDepart ? new Date(dto.dateDepart) : new Date(),
          poidsFactureKg: dto.poidsFactureKg
            ? new Prisma.Decimal(dto.poidsFactureKg)
            : undefined,
          coutFactureUsd: dto.coutFactureUsd
            ? new Prisma.Decimal(dto.coutFactureUsd)
            : undefined,
        },
      });
      if (count === 0) {
        throw new BadRequestException(
          `Le lot ${lot.referenceLot} est déjà parti`,
        );
      }
      await tx.colis.updateMany({
        where: { idLotExpedition: idLot, statutColis: 'prepare' },
        data: { statutColis: 'expedie' },
      });

      // « Expédiée » pour chaque commande dont tout est emballé et tout est parti
      return this.avancerCommandesDuLot(tx, idLot, async (idCommande) => {
        const commande = await tx.commande.findUniqueOrThrow({
          where: { idCommande },
          include: {
            lignes: LIGNES_ACHETEES,
            colis: { select: { statutColis: true } },
          },
        });
        const toutEmballe = commande.lignes.every(
          (l) => resteAEmballer(l) === 0,
        );
        const toutParti = commande.colis.every((c) =>
          PARTI.includes(c.statutColis),
        );
        return toutEmballe && toutParti
          ? franchirEtape(
              tx,
              idCommande,
              ORDRE_ETAPE.EXPEDIEE,
              `Lot ${lot.referenceLot}`,
            )
          : null;
      });
    });
    return { ...(await this.detailLot(idLot)), commandesAvancees: etapes };
  }

  // POST /lots/:id/arrivee : le lot est arrivé à Kinshasa
  async arrivee(idLot: number, dto: ArriveeLotDto) {
    const etapes = await this.prisma.$transaction(async (tx) => {
      const lot = await this.lotOuErreur(tx, idLot);
      const dateArrivee = dto.dateArrivee
        ? new Date(dto.dateArrivee)
        : new Date();
      if (lot.dateDepart && dateArrivee < lot.dateDepart) {
        throw new BadRequestException(
          "La date d'arrivée est avant la date de départ",
        );
      }

      // « parti » → « arrivé », une seule fois
      const { count } = await tx.lotExpedition.updateMany({
        where: { idLotExpedition: idLot, statutLot: 'parti' },
        data: { statutLot: 'arrive', dateArrivee },
      });
      if (count === 0) {
        throw new BadRequestException(
          `Le lot ${lot.referenceLot} n'est pas en route (statut : ${lot.statutLot})`,
        );
      }

      // « Arrivée à Kinshasa » pour chaque commande expédiée dont tous les lots sont arrivés
      return this.avancerCommandesDuLot(tx, idLot, async (idCommande) => {
        const colis = await tx.colis.findMany({
          where: { idCommande },
          select: { lotExpedition: { select: { statutLot: true } } },
        });
        const toutArrive = colis.every(
          (c) => c.lotExpedition?.statutLot === 'arrive',
        );
        const expediee = await tx.historiqueCommande.count({
          where: { idCommande, etape: { ordreEtape: ORDRE_ETAPE.EXPEDIEE } },
        });
        return toutArrive && expediee > 0
          ? franchirEtape(
              tx,
              idCommande,
              ORDRE_ETAPE.ARRIVEE_KINSHASA,
              `Lot ${lot.referenceLot}`,
            )
          : null;
      });
    });
    return { ...(await this.detailLot(idLot)), commandesAvancees: etapes };
  }

  // GET /lots
  async listerLots() {
    const lots = await this.prisma.lotExpedition.findMany({
      orderBy: { idLotExpedition: 'desc' },
      include: {
        agence: { select: { nomAgence: true } },
        _count: { select: { colis: true } }, // le nombre de colis, sans les charger
      },
    });
    return lots.map((l) => ({
      idLot: l.idLotExpedition,
      reference: l.referenceLot,
      agence: l.agence.nomAgence,
      statut: l.statutLot,
      dateDepart: l.dateDepart,
      dateArrivee: l.dateArrivee,
      nombreColis: l._count.colis,
    }));
  }

  // GET /lots/:id
  async detailLot(idLot: number) {
    const lot = await this.prisma.lotExpedition.findUnique({
      where: { idLotExpedition: idLot },
      include: {
        agence: { select: { nomAgence: true } },
        colis: {
          orderBy: { idColis: 'asc' },
          include: {
            commande: {
              select: {
                numeroCommande: true,
                client: { select: { nom: true, prenom: true } },
              },
            },
            _count: { select: { contenu: true } },
          },
        },
      },
    });
    if (!lot) {
      throw new NotFoundException(`Lot ${idLot} introuvable`);
    }
    return {
      idLot: lot.idLotExpedition,
      reference: lot.referenceLot,
      agence: lot.agence.nomAgence,
      statut: lot.statutLot,
      dateDepart: lot.dateDepart,
      dateArrivee: lot.dateArrivee,
      poidsFactureKg: lot.poidsFactureKg?.toFixed(3) ?? null,
      coutFactureUsd: lot.coutFactureUsd?.toFixed(2) ?? null,
      colis: lot.colis.map((c) => ({
        idColis: c.idColis,
        numeroCommande: c.commande.numeroCommande,
        client: `${c.commande.client.prenom} ${c.commande.client.nom}`,
        statut: c.statutColis,
        poidsReelKg: c.poidsReelKg?.toFixed(3) ?? null,
        lignes: c._count.contenu,
      })),
    };
  }

  // ------- outils internes -------

  // Met des colis préparés et libres dans un lot. Si l'un d'eux a été pris entre-temps, rien ne bouge.
  private async mettreDansLeLot(tx: Tx, idLot: number, idsColis: number[]) {
    const ids = [...new Set(idsColis)];
    const colis = await tx.colis.findMany({ where: { idColis: { in: ids } } });
    for (const id of ids) {
      const c = colis.find((x) => x.idColis === id);
      if (!c) {
        throw new NotFoundException(`Colis ${id} introuvable`);
      }
      if (c.statutColis !== 'prepare') {
        throw new BadRequestException(
          `Le colis ${id} est déjà parti (statut : ${c.statutColis})`,
        );
      }
      if (c.idLotExpedition !== null && c.idLotExpedition !== idLot) {
        throw new BadRequestException(
          `Le colis ${id} est déjà dans un autre lot`,
        );
      }
    }
    // la mise à jour ne touche que les colis encore libres : c'est elle qui arbitre deux agents simultanés
    const { count } = await tx.colis.updateMany({
      where: {
        idColis: { in: ids },
        statutColis: 'prepare',
        idLotExpedition: null,
      },
      data: { idLotExpedition: idLot },
    });
    const dejaDansCeLot = colis.filter(
      (c) => c.idLotExpedition === idLot,
    ).length;
    if (count + dejaDansCeLot !== ids.length) {
      throw new ConflictException(
        'Un des colis vient d’être mis dans un autre lot, réessayez',
      );
    }
  }

  // Applique une règle d'avancement à chaque commande qui a un colis dans ce lot
  private async avancerCommandesDuLot(
    tx: Tx,
    idLot: number,
    regle: (idCommande: number) => Promise<string | null>,
  ) {
    const colis = await tx.colis.findMany({
      where: { idLotExpedition: idLot },
      select: {
        idCommande: true,
        commande: { select: { numeroCommande: true } },
      },
      distinct: ['idCommande'],
    });
    const resultats: {
      numeroCommande: string;
      etapeFranchie: string | null;
    }[] = [];
    for (const c of colis) {
      resultats.push({
        numeroCommande: c.commande.numeroCommande,
        etapeFranchie: await regle(c.idCommande),
      });
    }
    return resultats;
  }

  private async lotOuErreur(tx: Tx, idLot: number) {
    const lot = await tx.lotExpedition.findUnique({
      where: { idLotExpedition: idLot },
    });
    if (!lot) {
      throw new NotFoundException(`Lot ${idLot} introuvable`);
    }
    return lot;
  }

  private async colisOuErreur(idColis: number) {
    const colis = await this.prisma.colis.findUnique({ where: { idColis } });
    if (!colis) {
      throw new NotFoundException(`Colis ${idColis} introuvable`);
    }
    return colis;
  }

  // Un colis, son contenu et ses photos
  private async presenterColis(tx: Tx, idColis: number) {
    const c = await tx.colis.findUniqueOrThrow({
      where: { idColis },
      include: {
        contenu: {
          include: {
            ligneCommande: {
              select: {
                variante: {
                  select: {
                    libelleVariante: true,
                    produit: { select: { nomProduit: true } },
                  },
                },
              },
            },
          },
        },
        photos: { select: { idPhotoColis: true } },
      },
    });
    return {
      idColis: c.idColis,
      idCommande: c.idCommande,
      statut: c.statutColis,
      poidsReelKg: c.poidsReelKg?.toFixed(3) ?? null,
      contenu: c.contenu.map((x) => ({
        idLigneCommande: x.idLigneCommande,
        produit: x.ligneCommande.variante.produit.nomProduit,
        variante: x.ligneCommande.variante.libelleVariante,
        quantite: x.quantiteEmballee,
      })),
      photos: c.photos.map(
        (p) => `/colis/${c.idColis}/photos/${p.idPhotoColis}`,
      ),
    };
  }
}
