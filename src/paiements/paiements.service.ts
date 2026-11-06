import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { montantsDus, resteAPayer } from '../commandes/montants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnregistrerPaiementDto } from './dto/enregistrer-paiement.dto.js';

@Injectable()
export class PaiementsService {
  constructor(private readonly prisma: PrismaService) {}

  async enregistrer(
    idCommande: number,
    dto: EnregistrerPaiementDto,
    agent: UtilisateurConnecte,
  ) {
    // 1. les règles qui ne dépendent pas de la base
    if (dto.moyen === 'avoir') {
      throw new BadRequestException(
        'Le paiement par avoir sera disponible au prochain pas',
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

    try {
      // 2. lire le reste, enregistrer, changer d'étape : comme si les agents passaient un par un
      return await this.prisma.$transaction(
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
          if (!commande) {
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

          // 4. le paiement, avec l'agent qui l'a enregistré
          const paiement = await tx.paiement.create({
            data: {
              idCommande,
              objetPaiement: dto.objet,
              moyenPaiement: dto.moyen,
              montantPayeUsd: montant,
              referencePaiement: dto.reference,
              idAgentEncaissement: agent.idUtilisateur,
            },
          });

          // 5. articles et transport entièrement payés : l'étape « Payée », une seule fois
          let etapeFranchie: string | null = null;
          const solde =
            dto.objet === 'articles_transport' && montant.eq(resteObjet);
          if (solde && !ordresFranchis.includes(ORDRE_ETAPE.PAYEE)) {
            const payee = await tx.etapeCommande.findFirst({
              where: { ordreEtape: ORDRE_ETAPE.PAYEE },
            });
            if (!payee) {
              throw new InternalServerErrorException(
                'Étape « Payée » absente de la table etape_commande',
              );
            }
            await tx.historiqueCommande.create({
              data: {
                idCommande,
                idEtapeCommande: payee.idEtapeCommande,
                commentaireEtape: `Paiement n°${paiement.idPaiement}`,
              },
            });
            etapeFranchie = payee.libelleEtape;
          }

          const apres = resteAPayer(commande, [
            ...commande.paiements,
            paiement,
          ]);
          return {
            idPaiement: paiement.idPaiement,
            date: paiement.datePaiement,
            objet: paiement.objetPaiement,
            moyen: paiement.moyenPaiement,
            montantUsd: paiement.montantPayeUsd.toFixed(2),
            reference: paiement.referencePaiement,
            etapeFranchie,
            montantDu: {
              articlesTransportUsd:
                montantsDus(commande).articles_transport.toFixed(2),
              soldeRetraitUsd: montantsDus(commande).solde_retrait.toFixed(2),
            },
            resteAPayer: {
              articlesTransportUsd: apres.articlesTransport.toFixed(2),
              soldeRetraitUsd: apres.soldeRetrait.toFixed(2),
              totalUsd: apres.total.toFixed(2),
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (erreur) {
      // P2034 = PostgreSQL a refusé une des deux transactions qui se croisaient
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === 'P2034'
      ) {
        throw new ConflictException(
          'Paiement en conflit avec un autre, réessayez',
        );
      }
      throw erreur;
    }
  }
}
