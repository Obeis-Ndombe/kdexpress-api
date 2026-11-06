import type { Request } from 'express';
import type { RoleUtilisateur } from '@prisma/client';

// Ce qu'on écrit dans le jeton : qui est l'utilisateur et quel est son rôle
export interface ContenuJeton {
  sub: number; // « subject » : l'id de l'utilisateur
  role: RoleUtilisateur;
}

// Ce que la garde accroche à la requête une fois le jeton vérifié
export interface UtilisateurConnecte {
  idUtilisateur: number;
  role: RoleUtilisateur;
}

// Une requête Express qui peut porter l'utilisateur connecté
export interface RequeteAuthentifiee extends Request {
  utilisateur?: UtilisateurConnecte;
}
