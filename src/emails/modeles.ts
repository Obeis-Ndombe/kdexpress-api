import { ORDRE_ETAPE } from '../commandes/etapes.js';
import type { Email } from './emails.service.js';

// Le texte des e-mails. Des fonctions simples : mêmes données, même e-mail.

const SIGNATURE = '\n\nL’équipe KDExpress\nKinshasa – Dubaï';

export function emailCodeReinitialisation(
  a: string,
  prenom: string,
  code: string,
  minutes: number,
): Email {
  return {
    a,
    sujet: `${code} : votre code KDExpress`,
    texte:
      `Bonjour ${prenom},\n\n` +
      `Voici votre code pour choisir un nouveau mot de passe : ${code}\n` +
      `Il est valable ${minutes} minutes et ne sert qu'une fois.\n\n` +
      `Si vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas. ` +
      `Ne donnez ce code à personne, pas même à un agent KDExpress.` +
      SIGNATURE,
  };
}

export function emailMotDePasseChange(a: string, prenom: string): Email {
  return {
    a,
    sujet: 'Votre mot de passe KDExpress a été changé',
    texte:
      `Bonjour ${prenom},\n\n` +
      `Le mot de passe de votre compte KDExpress vient d'être changé. ` +
      `Les appareils déjà connectés devront se reconnecter.\n\n` +
      `Si ce n'est pas vous, contactez tout de suite le bureau KDExpress.` +
      SIGNATURE,
  };
}

export interface CommandeNotifiee {
  numeroCommande: string;
  prenom: string;
  email: string;
  aPayerALaCommandeUsd: string;
  resteAuRetraitUsd: string;
  commentaire: string | null;
}

// L'e-mail d'une étape, ou null si cette étape ne prévient pas le client
export function emailEtape(ordre: number, c: CommandeNotifiee): Email | null {
  const n = c.numeroCommande;
  const messages: Record<number, { sujet: string; corps: string }> = {
    [ORDRE_ETAPE.EN_ATTENTE_PAIEMENT]: {
      sujet: `Commande ${n} enregistrée`,
      corps:
        `Votre commande ${n} est enregistrée.\n\n` +
        `Montant à payer pour lancer l'achat à Dubaï (articles + transport) : ${c.aPayerALaCommandeUsd} $.\n` +
        `Les frais de service (${c.resteAuRetraitUsd} $) se paient au retrait.`,
    },
    [ORDRE_ETAPE.PAYEE]: {
      sujet: `Commande ${n} : paiement reçu`,
      corps:
        `Nous avons bien reçu votre paiement pour la commande ${n}.\n` +
        `Nos agents à Dubaï vont maintenant acheter vos articles.`,
    },
    [ORDRE_ETAPE.EXPEDIEE]: {
      sujet: `Commande ${n} : en route vers Kinshasa`,
      corps: `Bonne nouvelle : votre commande ${n} a quitté Dubaï. Nous vous préviendrons dès qu'elle sera prête au retrait.`,
    },
    [ORDRE_ETAPE.PRETE_AU_RETRAIT]: {
      sujet: `Commande ${n} : prête au retrait`,
      corps:
        `Votre commande ${n} vous attend au bureau KDExpress de Kinshasa.\n\n` +
        `À apporter : votre code de retrait, visible dans le détail de la commande sur votre compte.\n` +
        `Reste à payer au retrait : ${c.resteAuRetraitUsd} $.\n\n` +
        `Ne communiquez votre code de retrait qu'au guichet, au moment de récupérer vos colis.`,
    },
    [ORDRE_ETAPE.RECUPEREE]: {
      sujet: `Commande ${n} : merci !`,
      corps:
        `Vous avez récupéré votre commande ${n}. Merci de votre confiance.\n` +
        `Votre avis nous aide à nous améliorer : vous pouvez le donner depuis le détail de la commande.`,
    },
    [ORDRE_ETAPE.ANNULEE]: {
      sujet: `Commande ${n} annulée`,
      corps:
        `Votre commande ${n} a été annulée.` +
        (c.commentaire ? `\nMotif : ${c.commentaire}` : '') +
        `\nSi vous aviez déjà payé, le montant vous est rendu sous forme d'avoir, visible sur votre compte.`,
    },
  };
  const message = messages[ordre];
  return message
    ? {
        a: c.email,
        sujet: message.sujet,
        texte: `Bonjour ${c.prenom},\n\n${message.corps}${SIGNATURE}`,
      }
    : null;
}
