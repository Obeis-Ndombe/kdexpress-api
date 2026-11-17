import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface Email {
  a: string; // l'adresse du destinataire
  sujet: string;
  texte: string;
}

// L'envoi des e-mails.
// Avec SMTP_URL dans le .env : envoi réel par le service choisi (Brevo, Mailjet, Gmail…).
// Sans SMTP_URL (sur ton ordinateur) : l'e-mail est seulement écrit dans le journal de l'API.
@Injectable()
export class EmailsService {
  private readonly journal = new Logger('E-mail');
  private readonly transport: Transporter | null;
  private readonly expediteur: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SMTP_URL', '').trim();
    this.expediteur = config.get<string>(
      'EMAIL_EXPEDITEUR',
      'KDExpress <ne-pas-repondre@kdexpress.local>',
    );
    this.transport = url
      ? createTransport({
          url,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        })
      : null;
  }

  // Renvoie true si l'e-mail est parti. Ne lève jamais d'erreur :
  // un e-mail qui ne part pas ne doit pas faire échouer une commande ou un paiement.
  async envoyer(email: Email): Promise<boolean> {
    if (!this.transport) {
      this.journal.log(
        `(non envoyé, SMTP_URL absent) À : ${email.a} | Sujet : ${email.sujet}\n${email.texte}`,
      );
      return true;
    }
    try {
      await this.transport.sendMail({
        from: this.expediteur,
        to: email.a,
        subject: email.sujet,
        text: email.texte,
      });
      return true;
    } catch (erreur) {
      this.journal.error(
        `Échec de l'envoi à ${email.a} (${email.sujet})`,
        erreur instanceof Error ? erreur.message : String(erreur),
      );
      return false;
    }
  }
}
