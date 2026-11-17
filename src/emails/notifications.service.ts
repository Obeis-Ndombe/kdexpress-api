import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { montantsDus } from '../commandes/montants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailsService } from './emails.service.js';
import { emailEtape } from './modeles.js';

const LOT = 20; // e-mails par passage
const DUREE_MAX_PASSAGE_MS = 60_000; // au-delà, le reste attend le passage suivant
const ABANDON_APRES_MS = 24 * 60 * 60 * 1000; // un e-mail qui échoue depuis 24 h n'est plus tenté

interface ANotifier {
  id_commande: number;
  id_etape_commande: number;
  ordre_etape: number;
  date_franchissement: Date;
  commentaire_etape: string | null;
}

// Prévient le client par e-mail quand sa commande franchit une étape.
//
// Le reste du code ne sait rien des e-mails : il écrit l'étape dans « historique_commande », comme avant.
// Ce service repasse régulièrement, cherche les étapes pas encore notifiées, envoie, puis coche.
// Avantages : aucun e-mail ne part pour une étape annulée par un retour en arrière de transaction,
// et un e-mail qui échoue (service d'envoi en panne) est retenté au passage suivant.
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly journal = new Logger('Notifications');
  private minuterie: NodeJS.Timeout | null = null;
  private enCours = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emails: EmailsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const secondes = Number(
      this.config.get('NOTIFICATIONS_INTERVALLE_SECONDES', 30),
    );
    if (!(secondes > 0)) {
      this.journal.warn(
        'Notifications par e-mail désactivées (intervalle à 0)',
      );
      return;
    }
    this.minuterie = setInterval(() => void this.passer(), secondes * 1000);
    this.minuterie.unref(); // n'empêche pas l'API de s'arrêter
  }

  onModuleDestroy() {
    if (this.minuterie) {
      clearInterval(this.minuterie);
    }
  }

  // Un passage : jamais deux en même temps, et jamais d'erreur qui remonte
  async passer(): Promise<number> {
    if (this.enCours) {
      return 0;
    }
    this.enCours = true;
    try {
      return await this.traiterUnLot();
    } catch (erreur) {
      this.journal.error(
        'Passage des notifications en échec',
        erreur instanceof Error ? erreur.stack : String(erreur),
      );
      return 0;
    } finally {
      this.enCours = false;
    }
  }

  private traiterUnLot(): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        // SKIP LOCKED : si deux serveurs tournent, chacun prend des lignes différentes
        const lignes = await tx.$queryRaw<ANotifier[]>`
          SELECT h.id_commande, h.id_etape_commande, e.ordre_etape,
                 h.date_franchissement, h.commentaire_etape
          FROM historique_commande h
          JOIN etape_commande e ON e.id_etape_commande = h.id_etape_commande
          WHERE h.date_notification IS NULL
          ORDER BY h.date_franchissement
          LIMIT ${LOT}
          FOR UPDATE OF h SKIP LOCKED`;

        const debut = Date.now();
        let envoyes = 0;
        for (const ligne of lignes) {
          // service d'envoi très lent : on s'arrête avant la fin de la transaction,
          // pour ne jamais envoyer un e-mail sans pouvoir le cocher (il partirait deux fois)
          if (Date.now() - debut > DUREE_MAX_PASSAGE_MS) {
            break;
          }
          const commande = await tx.commande.findUniqueOrThrow({
            where: { idCommande: ligne.id_commande },
            include: {
              lignes: true,
              client: { select: { prenom: true, email: true } },
            },
          });
          const dus = montantsDus(commande);
          const email = emailEtape(ligne.ordre_etape, {
            numeroCommande: commande.numeroCommande,
            prenom: commande.client.prenom,
            email: commande.client.email,
            aPayerALaCommandeUsd: dus.articles_transport.toFixed(2),
            resteAuRetraitUsd: dus.solde_retrait.toFixed(2),
            commentaire: ligne.commentaire_etape,
          });

          const parti = email ? await this.emails.envoyer(email) : true;
          const tropVieux =
            Date.now() - ligne.date_franchissement.getTime() > ABANDON_APRES_MS;
          if (!parti && !tropVieux) {
            continue; // on retentera au prochain passage
          }
          if (!parti) {
            this.journal.warn(
              `Abandon : e-mail de l'étape ${ligne.ordre_etape} de ${commande.numeroCommande} en échec depuis 24 h`,
            );
          }
          await tx.historiqueCommande.update({
            where: {
              idCommande_idEtapeCommande: {
                idCommande: ligne.id_commande,
                idEtapeCommande: ligne.id_etape_commande,
              },
            },
            data: { dateNotification: new Date() },
          });
          if (email && parti) {
            envoyes++;
          }
        }
        return envoyes;
      },
      { timeout: 120_000 },
    );
  }
}
