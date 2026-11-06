import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  RequeteAuthentifiee,
  UtilisateurConnecte,
} from '../auth.types.js';

// @Utilisateur() dans les paramètres d'une méthode : donne l'utilisateur connecté
export const Utilisateur = createParamDecorator(
  (_donnee: unknown, context: ExecutionContext): UtilisateurConnecte => {
    const requete = context.switchToHttp().getRequest<RequeteAuthentifiee>();
    return requete.utilisateur!; // la garde l'a forcément rempli sur une route non publique
  },
);
