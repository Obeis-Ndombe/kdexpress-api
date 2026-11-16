import { RoleUtilisateur } from '@prisma/client';

// Le personnel de KDExpress : il voit les commandes de tous les clients
export const PERSONNEL: RoleUtilisateur[] = [
  'agent_dubai',
  'agent_bureau',
  'direction',
];
