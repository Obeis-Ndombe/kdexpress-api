import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ContenuJeton, RequeteAuthentifiee } from './auth.types.js';
import { ROUTE_PUBLIQUE } from './decorateurs/public.decorator.js';

// La garde passe AVANT chaque route : elle décide si la requête peut entrer
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. la route (ou son controller) porte-t-elle @Public() ?
    const estPublique = this.reflector.getAllAndOverride<boolean>(
      ROUTE_PUBLIQUE,
      [
        context.getHandler(), // la méthode du controller
        context.getClass(), // le controller
      ],
    );
    if (estPublique) {
      return true;
    }

    // 2. on lit le jeton dans l'en-tête « Authorization: Bearer <jeton> »
    const requete = context.switchToHttp().getRequest<RequeteAuthentifiee>();
    const jeton = this.extraireJeton(requete);
    if (!jeton) {
      throw new UnauthorizedException('Connexion requise');
    }

    // 3. on vérifie la signature et la date d'expiration
    let contenu: ContenuJeton;
    try {
      contenu = await this.jwt.verifyAsync<ContenuJeton>(jeton);
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    // 4. le compte existe-t-il encore, et est-il toujours actif ?
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { idUtilisateur: contenu.sub },
      select: {
        idUtilisateur: true,
        roleUtilisateur: true,
        statutCompte: true,
        dateMotDePasse: true,
      },
    });
    if (!utilisateur) {
      throw new UnauthorizedException('Compte introuvable');
    }
    if (utilisateur.statutCompte !== 'actif') {
      throw new ForbiddenException("Ce compte n'est pas actif");
    }
    // un jeton émis avant le dernier changement de mot de passe ne vaut plus rien
    if (
      utilisateur.dateMotDePasse &&
      (contenu.iat ?? 0) * 1000 < utilisateur.dateMotDePasse.getTime()
    ) {
      throw new UnauthorizedException('Mot de passe changé : reconnectez-vous');
    }

    // 5. on accroche l'utilisateur à la requête, avec le rôle À JOUR de la base
    requete.utilisateur = {
      idUtilisateur: utilisateur.idUtilisateur,
      role: utilisateur.roleUtilisateur,
    };
    return true;
  }

  // « Bearer eyJhbGci… » → « eyJhbGci… »
  private extraireJeton(requete: RequeteAuthentifiee): string | undefined {
    const [type, jeton] = requete.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? jeton : undefined;
  }
}
