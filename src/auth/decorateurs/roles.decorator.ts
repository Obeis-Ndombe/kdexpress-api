import { SetMetadata } from '@nestjs/common';
import type { RoleUtilisateur } from '@prisma/client';

// L'étiquette que la garde des rôles cherche
export const ROLES_AUTORISES = 'rolesAutorises';

// @Roles('direction') ou @Roles('agent_dubai', 'direction') : seuls ces rôles entrent
export const Roles = (...roles: RoleUtilisateur[]) =>
  SetMetadata(ROLES_AUTORISES, roles);
