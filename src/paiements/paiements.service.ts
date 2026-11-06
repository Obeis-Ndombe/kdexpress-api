import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { AvoirsService } from '../avoirs/avoirs.service.js';
import { franchirEtape } from '../commandes/avancement.js';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { montantsDus, resteAPayer } from '../commandes/montants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnregistrerPaiementDto } from './dto/enregistrer-paiement.dto.js';

// Nombre d'essais quand deux paiements se croisent
const ESSAIS_CONFLIT = 3;

// PostgreSQL a refusé une transaction sérialisable (code SQL 40001).
// Prisma la signale par P2034 ; selon le moment du refus, l'erreur peut aussi arriver brute.
function estConflit(erreur: unknown): boolean {
  if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
    return erreur.code === 'P2034';
  }
  const cause = (erreur as { cause?: { originalCode?: string } } | null)?.cause;
  return cause?.originalCode === '40001';
}

@Injectable()
export class PaiementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avoirs: AvoirsService,
  ) {}

  async enregistrer(
    idCommande: number,
    dto: EnregistrerPaiementDto,
    utilisateur: UtilisateurConnecte,
  ) {
    // 1. les règles qui ne dépendent pas de la base
    const estClient =
      utilisateur.role === 'client' || utilisateur.role === 'revendeur';
    if (estClient && dto.moyen !== 'avoir') {
      throw new ForbiddenException(
        'Un client ne peut payer que par avoir ; les autres paiements se font au bureau',
      );
    }
    if (
      (dto.moyen === 'mobile_money' || dto.moyen === 'carte') &&
      !dto.reference
    ) {
      throw new BadRequestException(
        'La référence de la transaction est obligatoire pour un paiement mobile money ou carte',
      );
    }
    const montant = new Prisma.Decimal(dto.montantUsd);
    if (montant.lte(0)) {
      throw new BadRequestException('Le montant doit être supérieur à 0');
    }

    // 2. lire le reste, enregistrer, changer d'étape : comme si les paiements passaient un par un.
    // Si PostgreSQL refuse parce qu'un autre paiement s'est croisé avec celui-ci, on recommence :
    // au nouvel essai, on relit le reste et le solde À JOUR.
    for (let essai = 1; ; essai++) {
      try {
        return await this.transaction(
          idCommande,
          dto,
          utilisateur,
          estClient,
          montant,
        );
      } catch (erreur) {
        if (!estConflit(erreur)) {
          throw erreur;
        }
        if (essai === ESSAIS_CONFLIT) {
          throw new ConflictException(
            'Paiement en conflit avec un autre, réessayez',
          );
        }
      }
    }
  }

  // ------- outils internes -------

  private transaction(
    idCommande: number,
    dto: EnregistrerPaiementDto,
    utilisateur: UtilisateurConnecte,
    estClient: boolean,
    montant: Prisma.Decimal,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const commande = await tx.commande.findUnique({
          where: { idCommande },
          include: {
            lignes: { select: { prixUnitaireAed: true, quantite: true } },
            paiements: {
              select: { objetPaiement: true, montantPayeUsd: true },
            },
            historique: { include: { etape: true } },
          },
        });
        // un client ne voit pas les commandes des autres : « introuvable »
        if (
          !commande ||
          (estClient && commande.idClient !== utilisateur.idUtilisateur)
        ) {
          throw new NotFoundException(`Commande ${idCommande} introuvable`);
        }
        const ordresFranchis = commande.historique.map(
          (h) => h.etape.ordreEtape,
        );
        if (ordresFranchis.includes(ORDRE_ETAPE.ANNULEE)) {
          throw new BadRequestException('Cette commande est annulée');
        }
        if (dto.objet === 'frais_stockage') {
          throw new BadRequestException(
            'Aucun frais de stockage n’est dû pour le moment',
          );
        }

        // 3. jamais plus que ce qui reste à payer pour cet objet
        const avant = resteAPayer(commande, commande.paiements);
        const resteObjet =
          dto.objet === 'articles_transport'
            ? avant.articlesTransport
            : avant.soldeRetrait;
        if (montant.gt(resteObjet)) {
          throw new BadRequestException(
            `Montant supérieur au reste à payer (${resteObjet.toFixed(2)} $)`,
          );
        }

        // 4. par avoir : jamais plus que le solde, lu DANS la transaction
        let soldeAvoirApres: Prisma.Decimal | null = null;
        if (dto.moyen === 'avoir') {
          const solde = await this.avoirs.solde(commande.idClient, tx);
          if (montant.gt(solde)) {
            throw new BadRequestException(
              `Solde d'avoir insuffisant (${solde.toFixed(2)} $)`,
            );
          }
          await this.avoirs.debiter(
            commande.idClient,
            montant,
            `Paiement de la commande ${commande.numeroCommande}`,
            idCommande,
            tx,
          );
          soldeAvoirApres = solde.sub(montant);
        }

        // 5. le paiement ; l'encaisseur est l'agent, ou personne si le client paie par avoir
        const paiement = await tx.paiement.create({
          data: {
            idCommande,
            objetPaiement: dto.objet,
            moyenPaiement: dto.moyen,
            montantPayeUsd: montant,
            referencePaiement: dto.reference,
            idAgentEncaissement: estClient ? null : utilisateur.idUtilisateur,
          },
        });

        // 6. articles et transport entièrement payés : l'étape « Payée », une seule fois
        const solde =
          dto.objet === 'articles_transport' && montant.eq(resteObjet);
        const etapeFranchie = solde
          ? await franchirEtape(
              tx,
              idCommande,
              ORDRE_ETAPE.PAYEE,
              `Paiement n°${paiement.idPaiement}`,
            )
          : null;

        const dus = montantsDus(commande);
        const apres = resteAPayer(commande, [...commande.paiements, paiement]);
        return {
          idPaiement: paiement.idPaiement,
          date: paiement.datePaiement,
          objet: paiement.objetPaiement,
          moyen: paiement.moyenPaiement,
          montantUsd: paiement.montantPayeUsd.toFixed(2),
          reference: paiement.referencePaiement,
          etapeFranchie,
          montantDu: {
            articlesTransportUsd: dus.articles_transport.toFixed(2),
            soldeRetraitUsd: dus.solde_retrait.toFixed(2),
          },
          resteAPayer: {
            articlesTransportUsd: apres.articlesTransport.toFixed(2),
            soldeRetraitUsd: apres.soldeRetrait.toFixed(2),
            totalUsd: apres.total.toFixed(2),
          },
          ...(soldeAvoirApres
            ? { soldeAvoirUsd: soldeAvoirApres.toFixed(2) }
            : {}),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
