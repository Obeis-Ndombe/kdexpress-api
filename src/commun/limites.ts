import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import type { Request } from 'express';
import type { UtilisateurConnecte } from '../auth/auth.types.js';

const UNE_MINUTE = 60_000;

// Deux compteurs, remis à zéro chaque minute :
//   general : toutes les routes, par utilisateur connecté (ou par adresse IP sinon)
//   compte  : la connexion seulement, par adresse IP ET par email visé.
//             Compter par IP seule punirait tout un cybercafé pour une personne ;
//             compter par email seul permettrait de bloquer le compte de quelqu'un d'autre.
export const LIMITES: ThrottlerModuleOptions = [
  { name: 'general', ttl: UNE_MINUTE, limit: 120 },
  {
    name: 'compte',
    ttl: UNE_MINUTE,
    limit: 5,
    skipIf: (contexte) => !estConnexion(requete(contexte)),
    getTracker: (req) => {
      const r = req as unknown as Request;
      const email = (r.body as { email?: unknown } | undefined)?.email;
      const vise = typeof email === 'string' ? email.trim().toLowerCase() : '';
      return `${r.ip}|${vise.slice(0, 254)}`;
    },
  },
];

// Les limites plus strictes de certaines routes : @Throttle(LIMITE_CONNEXION)…
export const LIMITE_CONNEXION = { general: { ttl: UNE_MINUTE, limit: 20 } }; // par adresse, tous emails confondus
export const LIMITE_INSCRIPTION = { general: { ttl: UNE_MINUTE, limit: 10 } };
export const LIMITE_MOT_DE_PASSE = { general: { ttl: UNE_MINUTE, limit: 10 } };
export const LIMITE_CODE_RETRAIT = { general: { ttl: UNE_MINUTE, limit: 20 } }; // un code ne se devine pas

function requete(contexte: ExecutionContext): Request {
  return contexte.switchToHttp().getRequest<Request>();
}

function estConnexion(req: Request): boolean {
  // la connexion et les deux routes « mot de passe oublié » : 5 par minute pour un même e-mail
  return (
    req.method === 'POST' &&
    [
      '/auth/connexion',
      '/auth/mot-de-passe-oublie',
      '/auth/mot-de-passe-reinitialise',
    ].includes(req.path)
  );
}

// La garde des limites. Elle passe après l'authentification :
// un utilisateur connecté est compté sous son propre nom, pas sous l'adresse qu'il partage.
@Injectable()
export class LimitesGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as Request & { utilisateur?: UtilisateurConnecte };
    return Promise.resolve(
      r.utilisateur ? `u${r.utilisateur.idUtilisateur}` : (r.ip ?? 'inconnu'),
    );
  }

  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      'Trop de tentatives, réessayez dans une minute',
    );
  }
}
