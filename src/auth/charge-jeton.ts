import type { RoleUtilisateur } from '@prisma/client';

// Ce qu'on range DANS le jeton : le minimum pour savoir qui appelle
export interface ChargeJeton {
  sub: number; // l'id de l'utilisateur (« subject »)
  role: RoleUtilisateur; // le rôle de l'utilisateur, pour savoir ce qu'il peut faire
}