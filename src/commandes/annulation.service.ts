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
import { avecEssais, SERIALISABLE } from '../commun/transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { franchirEtape } from './avancement.js';
import { ORDRE_ETAPE } from './etapes.js';
import { remboursementLigne } from './montants.js';

type Decimal = Prisma.Decimal;

// Ce qui revient au client en avoir lors d'une annulation
interface Restitution {
  motif: string;
  montant: Decimal;
}

const somme = (montants: Decimal[]) =>
  montants.reduce((total, m) => total.add(m), new Prisma.Decimal(0));

// Les deux cas où une commande s'annule :
//  a. elle n'est pas encore payée (le client a changé d'avis) : on rend un éventuel acompte ;
//  b. aucun article n'a été trouvé à Dubaï : on rembourse ce qui ne l'est pas encore.
@Injectable()
export class AnnulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avoirs: AvoirsService,
  ) {}

  annuler(idCommande: number, motif: string, utilisateur: UtilisateurConnecte) {
    const estClient =
      utilisateur.role === 'client' || utilisateur.role === 'revendeur';

    return avecEssais(
      () =>
        this.prisma.$transaction(async (tx) => {
          const c = await tx.commande.findUnique({
            where: { idCommande },
            include: {
              lignes: {
                include: {
                  variante: {
                    select: {
                      libelleVariante: true,
                      produit: { select: { nomProduit: true } },
                    },
                  },
                },
              },
              paiements: {
                select: { objetPaiement: true, montantPayeUsd: true },
              },
              historique: {
                select: { etape: { select: { ordreEtape: true } } },
              },
            },
          });
          // un client ne voit pas les commandes des autres
          if (!c || (estClient && c.idClient !== utilisateur.idUtilisateur)) {
            throw new NotFoundException(`Commande ${idCommande} introuvable`);
          }

          const ordres = c.historique.map((h) => h.etape.ordreEtape);
          if (ordres.includes(ORDRE_ETAPE.ANNULEE)) {
            throw new BadRequestException('Cette commande est déjà annulée');
          }
          if (ordres.includes(ORDRE_ETAPE.RECUPEREE)) {
            throw new BadRequestException(
              'Cette commande a déjà été récupérée',
            );
          }

          const restitutions: Restitution[] = [];

          if (!ordres.includes(ORDRE_ETAPE.PAYEE)) {
            // a. pas encore payée : on rend tout ce qui a été versé
            const verse = somme(c.paiements.map((p) => p.montantPayeUsd));
            if (estClient && verse.gt(0)) {
              throw new ForbiddenException(
                'Un acompte a déjà été versé : adressez-vous au bureau pour annuler',
              );
            }
            if (verse.gt(0)) {
              restitutions.push({
                motif: `Annulation de ${c.numeroCommande} : paiements reçus`,
                montant: verse,
              });
            }
          } else {
            // b. payée : seulement si AUCUN article n'a été acheté ni n'attend d'achat
            if (estClient) {
              throw new ForbiddenException(
                'Une commande payée ne peut être annulée que par la direction',
              );
            }
            const statuts = c.lignes.map((l) => l.statutLigneCommande);
            if (statuts.includes('achetee')) {
              throw new BadRequestException(
                'Des articles sont déjà achetés : la commande ne peut plus être annulée',
              );
            }
            if (statuts.includes('a_acheter')) {
              throw new BadRequestException(
                'Des articles attendent encore un achat à Dubaï : signalez-les introuvables avant d’annuler',
              );
            }

            // les lignes introuvables pas encore remboursées : article + part du transport
            for (const ligne of c.lignes.filter(
              (l) => l.statutLigneCommande === 'introuvable',
            )) {
              const { count } = await tx.ligneCommande.updateMany({
                where: {
                  idLigneCommande: ligne.idLigneCommande,
                  statutLigneCommande: 'introuvable',
                },
                data: { statutLigneCommande: 'remboursee' },
              });
              if (count === 0) {
                throw new ConflictException(
                  'Une ligne vient d’être remboursée, réessayez',
                );
              }
              restitutions.push({
                motif: `${ligne.variante.produit.nomProduit} ${ligne.variante.libelleVariante} introuvable – ${c.numeroCommande}`,
                montant: remboursementLigne(c, ligne).totalUsd,
              });
            }

            // les frais de service déjà payés : la commande ne sera jamais retirée
            const fraisPayes = somme(
              c.paiements
                .filter((p) => p.objetPaiement === 'solde_retrait')
                .map((p) => p.montantPayeUsd),
            );
            if (fraisPayes.gt(0)) {
              restitutions.push({
                motif: `Annulation de ${c.numeroCommande} : frais de service`,
                montant: fraisPayes,
              });
            }
          }

          // les avoirs, puis l'étape « Annulée » avec le motif
          for (const r of restitutions) {
            await this.avoirs.ajouterCredit(
              c.idClient,
              r.montant,
              r.motif.slice(0, 255),
              idCommande,
              tx,
            );
          }
          await franchirEtape(tx, idCommande, ORDRE_ETAPE.ANNULEE, motif);

          return {
            idCommande,
            numeroCommande: c.numeroCommande,
            etape: 'Annulée',
            motif,
            avoirs: restitutions.map((r) => ({
              motif: r.motif,
              montantUsd: r.montant.toFixed(2),
            })),
            totalRembourseUsd: somme(
              restitutions.map((r) => r.montant),
            ).toFixed(2),
            soldeAvoirUsd: (await this.avoirs.solde(c.idClient, tx)).toFixed(2),
          };
        }, SERIALISABLE),
      'Annulation en conflit avec une autre action, réessayez',
    );
  }
}
