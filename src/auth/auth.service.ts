import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Utilisateur } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConnexionDto } from './dto/connexion.dto.js';
import { InscriptionDto } from './dto/inscription.dto.js';

// Ce qu'on écrit dans le jeton : qui est l'utilisateur et quel est son rôle
export interface ContenuJeton {
  sub: number; // « subject » : l'id de l'utilisateur
  role: Utilisateur['roleUtilisateur'];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // Un nouveau compte créé par l'appli est toujours un compte client
  async inscrire(dto: InscriptionDto) {
    // 1. on ne garde jamais le mot de passe, seulement son empreinte
    const motDePasseHash = await hash(dto.motDePasse, 10);

    try {
      // 2. on enregistre l'utilisateur
      const utilisateur = await this.prisma.utilisateur.create({
        data: {
          nom: dto.nom,
          prenom: dto.prenom,
          email: dto.email,
          telephone: dto.telephone,
          motDePasseHash,
          roleUtilisateur: 'client',
        },
      });
      // 3. on renvoie le profil, sans le hash
      return this.profil(utilisateur);
    } catch (erreur) {
      // P2002 = la base refuse un doublon sur une colonne @unique (ici l'e-mail)
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === 'P2002'
      ) {
        throw new ConflictException('Un compte existe déjà avec cet e-mail');
      }
      throw erreur;
    }
  }

  // Vérifie l'e-mail et le mot de passe, puis remet un jeton
  async connecter(dto: ConnexionDto) {
    // 1. on cherche le compte par son e-mail
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    // 2. on compare le mot de passe tapé à l'empreinte enregistrée
    const motDePasseCorrect = utilisateur
      ? await compare(dto.motDePasse, utilisateur.motDePasseHash)
      : false;

    // même message dans les deux cas : on ne dit pas à un inconnu si l'e-mail existe
    if (!utilisateur || !motDePasseCorrect) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }

    // 3. un compte suspendu ou pas encore validé ne peut pas se connecter
    if (utilisateur.statutCompte !== 'actif') {
      throw new ForbiddenException("Ce compte n'est pas actif");
    }

    // 4. on fabrique le jeton signé avec le secret du serveur
    const contenu: ContenuJeton = {
      sub: utilisateur.idUtilisateur,
      role: utilisateur.roleUtilisateur,
    };
    const jetonAcces = await this.jwt.signAsync(contenu);

    return { jetonAcces, utilisateur: this.profil(utilisateur) };
  }

  // ------- outils internes -------

  // Ce qu'on montre d'un utilisateur : JAMAIS le hash du mot de passe
  private profil(u: Utilisateur) {
    return {
      idUtilisateur: u.idUtilisateur,
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      telephone: u.telephone,
      role: u.roleUtilisateur,
    };
  }
}
