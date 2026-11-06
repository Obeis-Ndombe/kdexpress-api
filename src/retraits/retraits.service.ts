import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { franchirEtape } from '../commandes/avancement.js';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { resteAPayer } from '../commandes/montants.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class RetraitsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /retraits/:code : ce que l'agent voit avant de remettre
  async verifier(code: string) {
    const c = await this.chargerParCode(this.prisma, code);
    const etat = this.etat(c);
    return {
      idCommande: c.idCommande,
      numeroCommande: c.numeroCommande,
      client: {
        nom: c.client.nom,
        prenom: c.client.prenom,
        telephone: c.client.telephone,
      },
      etape: c.historique.at(-1)?.etape.libelleEtape ?? null,
      colis: c.colis.map((x) => ({
        idColis: x.idColis,
        statut: x.statutColis,
        poidsReelKg: x.poidsReelKg?.toFixed(3) ?? null,
      })),
      resteAPayer: {
        articlesTransportUsd: etat.reste.articlesTransport.toFixed(2),
        soldeRetraitUsd: etat.reste.soldeRetrait.toFixed(2),
        totalUsd: etat.reste.total.toFixed(2),
      },
      peutEtreRemise: etat.probleme === null,
      probleme: etat.probleme,
    };
  }

  // POST /retraits : l'agent remet les colis au client
  remettre(code: string, agent: UtilisateurConnecte) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.chargerParCode(tx, code);
      const { probleme } = this.etat(c);
      if (probleme) {
        throw new BadRequestException(probleme);
      }

      // « arrivé » → « remis », une seule fois ; si un autre agent vient de le faire, rien ne bouge
      const maintenant = new Date();
      const { count } = await tx.colis.updateMany({
        where: { idCommande: c.idCommande, statutColis: 'arrive' },
        data: {
          statutColis: 'remis',
          dateRemise: maintenant,
          idAgentRemise: agent.idUtilisateur,
        },
      });
      if (count !== c.colis.length) {
        throw new BadRequestException(
          'Cette commande vient d’être remise par un autre agent',
        );
      }
      await franchirEtape(tx, c.idCommande, ORDRE_ETAPE.RECUPEREE);

      return {
        idCommande: c.idCommande,
        numeroCommande: c.numeroCommande,
        client: `${c.client.prenom} ${c.client.nom}`,
        colisRemis: c.colis.map((x) => x.idColis),
        dateRemise: maintenant,
        etape: 'Récupérée',
      };
    });
  }

  // ------- outils internes -------

  private async chargerParCode(tx: Tx, code: string) {
    const c = await tx.commande.findUnique({
      where: { codeRetrait: code.trim().toUpperCase() },
      include: {
        client: { select: { nom: true, prenom: true, telephone: true } },
        colis: { orderBy: { idColis: 'asc' } },
        lignes: { select: { prixUnitaireAed: true, quantite: true } },
        paiements: { select: { objetPaiement: true, montantPayeUsd: true } },
        historique: {
          orderBy: { etape: { ordreEtape: 'asc' } },
          include: { etape: true },
        },
      },
    });
    if (!c) {
      throw new NotFoundException('Code de retrait inconnu');
    }
    return c;
  }

  // Peut-on remettre cette commande ? Sinon, pourquoi (le message montré à l'agent)
  private etat(c: Awaited<ReturnType<RetraitsService['chargerParCode']>>) {
    const ordres = c.historique.map((h) => h.etape.ordreEtape);
    const reste = resteAPayer(c, c.paiements);
    let probleme: string | null = null;

    if (ordres.includes(ORDRE_ETAPE.ANNULEE)) {
      probleme = 'Cette commande est annulée';
    } else if (ordres.includes(ORDRE_ETAPE.RECUPEREE)) {
      probleme = 'Cette commande a déjà été récupérée';
    } else if (!ordres.includes(ORDRE_ETAPE.PRETE_AU_RETRAIT)) {
      probleme = 'Cette commande n’est pas encore prête au retrait';
    } else if (
      c.colis.length === 0 ||
      c.colis.some((x) => x.statutColis !== 'arrive')
    ) {
      probleme = 'Tous les colis ne sont pas encore au bureau';
    } else if (reste.total.gt(0)) {
      const detail = reste.articlesTransport.gt(0)
        ? 'articles et transport'
        : 'frais de service';
      probleme = `Il reste ${reste.total.toFixed(2)} $ à payer (${detail})`;
    }
    return { reste, probleme };
  }
}
