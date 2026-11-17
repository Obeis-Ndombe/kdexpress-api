import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { EmailsService } from '../emails/emails.service.js';
import {
  emailCodeReinitialisation,
  emailMotDePasseChange,
} from '../emails/modeles.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ContenuJeton } from './auth.types.js';
import {
  ChangerMotDePasseDto,
  ModifierProfilDto,
  ReinitialiserMotDePasseDto,
} from './dto/compte.dto.js';

const VALIDITE_CODE_MINUTES = 15;
const TENTATIVES_MAX = 5; // par code : 6 chiffres ne se devinent pas en 5 essais
const DELAI_ENTRE_DEMANDES_MS = 60_000;
// Sans ce plafond, on pourrait redemander un code chaque minute et tenter 5 essais à chaque fois
const CODES_MAX_PAR_JOUR = 5;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// même réponse que le compte existe ou non : on ne révèle pas qui a un compte
const REPONSE_OUBLI = {
  message:
    'Si un compte existe avec cet e-mail, un code vient de lui être envoyé',
};
const CODE_REFUSE = 'Code invalide ou expiré';

// La gestion de son propre compte : profil, mot de passe, mot de passe oublié
@Injectable()
export class CompteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly emails: EmailsService,
  ) {}

  // PATCH /auth/moi
  async modifierProfil(idUtilisateur: number, dto: ModifierProfilDto) {
    const u = await this.prisma.utilisateur.update({
      where: { idUtilisateur },
      data: { nom: dto.nom, prenom: dto.prenom, telephone: dto.telephone },
    });
    return {
      idUtilisateur: u.idUtilisateur,
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      telephone: u.telephone,
      role: u.roleUtilisateur,
    };
  }

  // POST /auth/mot-de-passe : il faut connaître l'actuel.
  // Tous les anciens jetons cessent de marcher ; on en remet un neuf à l'appareil qui a fait le changement.
  async changerMotDePasse(idUtilisateur: number, dto: ChangerMotDePasseDto) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { idUtilisateur },
    });
    if (!utilisateur) {
      throw new NotFoundException('Compte introuvable');
    }
    if (!(await compare(dto.motDePasseActuel, utilisateur.motDePasseHash))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    if (dto.nouveauMotDePasse === dto.motDePasseActuel) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent de l’actuel',
      );
    }
    await this.enregistrerMotDePasse(idUtilisateur, dto.nouveauMotDePasse);
    void this.emails.envoyer(
      emailMotDePasseChange(utilisateur.email, utilisateur.prenom),
    );
    const contenu: ContenuJeton = {
      sub: utilisateur.idUtilisateur,
      role: utilisateur.roleUtilisateur,
    };
    return {
      message: 'Mot de passe changé',
      jetonAcces: await this.jwt.signAsync(contenu),
    };
  }

  // POST /auth/mot-de-passe-oublie : envoie un code à 6 chiffres par e-mail
  async demanderCode(email: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    if (!utilisateur || utilisateur.statutCompte !== 'actif') {
      return REPONSE_OUBLI;
    }
    // pas plus d'un code par minute (on ne noie pas sa boîte), ni de 5 par jour
    const duJour = await this.prisma.reinitialisationMotDePasse.findMany({
      where: {
        idUtilisateur: utilisateur.idUtilisateur,
        dateDemande: { gt: new Date(Date.now() - UN_JOUR_MS) },
      },
      select: { dateDemande: true },
    });
    const recente = duJour.some(
      (d) => d.dateDemande.getTime() > Date.now() - DELAI_ENTRE_DEMANDES_MS,
    );
    if (recente || duJour.length >= CODES_MAX_PAR_JOUR) {
      return REPONSE_OUBLI;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      // un nouveau code annule les précédents
      this.prisma.reinitialisationMotDePasse.updateMany({
        where: {
          idUtilisateur: utilisateur.idUtilisateur,
          dateUtilisation: null,
        },
        data: { dateUtilisation: new Date() },
      }),
      this.prisma.reinitialisationMotDePasse.create({
        data: {
          idUtilisateur: utilisateur.idUtilisateur,
          codeHash: empreinte(code, utilisateur.idUtilisateur),
          dateDemande: new Date(), // la même horloge (celle de l'API) pour toutes les dates comparées
          dateExpiration: new Date(Date.now() + VALIDITE_CODE_MINUTES * 60_000),
        },
      }),
    ]);
    // sans attendre l'envoi : la réponse met le même temps que le compte existe ou non
    void this.emails.envoyer(
      emailCodeReinitialisation(
        utilisateur.email,
        utilisateur.prenom,
        code,
        VALIDITE_CODE_MINUTES,
      ),
    );
    return REPONSE_OUBLI;
  }

  // POST /auth/mot-de-passe-reinitialise : le code + le nouveau mot de passe
  async reinitialiser(dto: ReinitialiserMotDePasseDto) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });
    const demande =
      utilisateur && utilisateur.statutCompte === 'actif'
        ? await this.prisma.reinitialisationMotDePasse.findFirst({
            where: {
              idUtilisateur: utilisateur.idUtilisateur,
              dateUtilisation: null,
              dateExpiration: { gt: new Date() },
            },
            orderBy: { idReinitialisation: 'desc' },
          })
        : null;
    if (!utilisateur || !demande) {
      throw new BadRequestException(CODE_REFUSE);
    }

    // l'essai est compté AVANT de comparer, et en une seule requête :
    // cent essais lancés en même temps n'en font jamais passer plus de cinq
    const essai = await this.prisma.reinitialisationMotDePasse.updateMany({
      where: {
        idReinitialisation: demande.idReinitialisation,
        dateUtilisation: null,
        tentatives: { lt: TENTATIVES_MAX },
      },
      data: { tentatives: { increment: 1 } },
    });
    const bon = timingSafeEqual(
      Buffer.from(empreinte(dto.code, utilisateur.idUtilisateur)),
      Buffer.from(demande.codeHash),
    );
    if (essai.count === 0 || !bon) {
      throw new BadRequestException(CODE_REFUSE);
    }

    // le code ne sert qu'une fois
    const utilise = await this.prisma.reinitialisationMotDePasse.updateMany({
      where: {
        idReinitialisation: demande.idReinitialisation,
        dateUtilisation: null,
      },
      data: { dateUtilisation: new Date() },
    });
    if (utilise.count === 0) {
      throw new BadRequestException(CODE_REFUSE);
    }
    await this.enregistrerMotDePasse(
      utilisateur.idUtilisateur,
      dto.nouveauMotDePasse,
    );
    void this.emails.envoyer(
      emailMotDePasseChange(utilisateur.email, utilisateur.prenom),
    );
    return { message: 'Mot de passe changé, vous pouvez vous connecter' };
  }

  // ------- outils internes -------

  // La date du changement est arrondie à la seconde, comme la date d'émission des jetons :
  // le jeton remis juste après reste valable, tous les plus anciens sont refusés.
  private async enregistrerMotDePasse(
    idUtilisateur: number,
    motDePasse: string,
  ) {
    const maintenant = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.prisma.utilisateur.update({
      where: { idUtilisateur },
      data: {
        motDePasseHash: await hash(motDePasse, 10),
        dateMotDePasse: maintenant,
      },
    });
  }
}

// On ne garde jamais le code, seulement son empreinte (liée au compte)
function empreinte(code: string, idUtilisateur: number): string {
  return createHash('sha256').update(`${idUtilisateur}:${code}`).digest('hex');
}
