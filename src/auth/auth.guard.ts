import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChargeJeton } from './charge-jeton.js';

// La forme de la requête qui nous intéresse ici
interface RequeteAvecJeton {
  headers: { authorization?: string };
  utilisateur?: ChargeJeton;
}

// Le garde : laisse passer seulement les requêtes avec un jeton valide
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requete = context.switchToHttp().getRequest<RequeteAvecJeton>();

    // en-tête attendu : Authorization: Bearer <jeton>
    const [type, jeton] = requete.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !jeton) {
      throw new UnauthorizedException('Jeton manquant');
    }

    try {
      // vérifie la signature et la date d'expiration
      requete.utilisateur = await this.jwt.verifyAsync<ChargeJeton>(jeton);
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    return true;
  }
}