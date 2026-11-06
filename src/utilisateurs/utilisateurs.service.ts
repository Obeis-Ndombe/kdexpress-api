import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleUtilisateur, StatutCompte } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreerUtilisateurDto } from './dto/creer-utilisateur.dto.js';

// Les colonnes à ne JAMAIS renvoyer
const SANS_MOT_DE_PASSE = { motDePasseHash: true } as const;

@Injectable()
export class UtilisateursService {
  constructor(private readonly prisma: PrismaService) {}

  // La liste des comptes, éventuellement filtrée par rôle
  lister(role?: RoleUtilisateur) {
    return this.prisma.utilisateur.findMany({
      where: { roleUtilisateur: role }, // undefined = pas de filtre
      omit: SANS_MOT_DE_PASSE,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  // La direction crée un compte avec le rôle de son choix
  async creer(dto: CreerUtilisateurDto) {
    try {
      return await this.prisma.utilisateur.create({
        data: {
          nom: dto.nom,
          prenom: dto.prenom,
          email: dto.email,
          telephone: dto.telephone,
          motDePasseHash: await hash(dto.motDePasse, 10),
          roleUtilisateur: dto.role,
        },
        omit: SANS_MOT_DE_PASSE,
      });
    } catch (erreur) {
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === 'P2002'
      ) {
        throw new ConflictException('Un compte existe déjà avec cet e-mail');
      }
      throw erreur;
    }
  }

  // Activer, mettre en attente ou suspendre un compte
  async changerStatut(
    idUtilisateur: number,
    statut: StatutCompte,
    idDemandeur: number,
  ) {
    // on évite que la direction se bloque elle-même dehors
    if (idUtilisateur === idDemandeur) {
      throw new BadRequestException(
        'Vous ne pouvez pas changer le statut de votre propre compte',
      );
    }

    try {
      return await this.prisma.utilisateur.update({
        where: { idUtilisateur },
        data: { statutCompte: statut },
        omit: SANS_MOT_DE_PASSE,
      });
    } catch (erreur) {
      // P2025 = la ligne à modifier n'existe pas
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === 'P2025'
      ) {
        throw new NotFoundException(`Utilisateur ${idUtilisateur} introuvable`);
      }
      throw erreur;
    }
  }
}
