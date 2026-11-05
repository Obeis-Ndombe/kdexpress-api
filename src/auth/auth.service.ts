import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Utilisateur } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { InscriptionDto } from './dto/inscription.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà avec cet e-mail');
      }
      throw erreur;
    }
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