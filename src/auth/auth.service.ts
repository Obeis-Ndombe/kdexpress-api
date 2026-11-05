import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Utilisateur } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChargeJeton } from './charge-jeton.js';
import { ConnexionDto } from './dto/connexion.dto.js';
import { InscriptionDto } from './dto/inscription.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // POST /auth/inscription : un nouveau compte est toujours un compte client
  async inscrire(dto: InscriptionDto) {
    // on ne stocke jamais le mot de passe en clair, mais un hash
    const motDePasseHash = await hash(dto.motDePasse, 10); 

    try {
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
      return this.reponseAvecJeton(utilisateur); 
    } catch (erreur) {
      // P2002 = la base refuse un doublon sur une colonne @unique (ici l'e-mail)
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà avec cet e-mail');
      }
      throw erreur;
    }
  }

  // POST /auth/connexion
  async connecter(dto: ConnexionDto) {
    const utilisateur = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });

    // même message dans les deux cas : on ne révèle pas si l'e-mail existe
    if (!utilisateur || !(await compare(dto.motDePasse, utilisateur.motDePasseHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    if (utilisateur.statutCompte !== 'actif') {
      throw new ForbiddenException(`Compte ${utilisateur.statutCompte}`);
    }
    return this.reponseAvecJeton(utilisateur);
  }

  // GET /auth/moi
  async moi(idUtilisateur: number) {
    const utilisateur = await this.prisma.utilisateur.findUnique({ where: { idUtilisateur } });
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.profil(utilisateur);
  }

  // ------- outils internes -------

  private async reponseAvecJeton(utilisateur: Utilisateur) {
    const charge: ChargeJeton = { sub: utilisateur.idUtilisateur, role: utilisateur.roleUtilisateur };
    return {
      jeton: await this.jwt.signAsync(charge),
      utilisateur: this.profil(utilisateur),
    };
  }

  // ce qu'on montre d'un utilisateur : JAMAIS le hash du mot de passe
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