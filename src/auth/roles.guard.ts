import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleUtilisateur } from '@prisma/client';
import type { RequeteAuthentifiee } from './auth.types.js';
import { ROLES_AUTORISES } from './decorateurs/roles.decorator.js';

// Passe APRÈS la garde JWT : on sait déjà qui est l'utilisateur, on vérifie son rôle
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. quels rôles la route (ou son controller) accepte-t-elle ?
    const rolesAutorises = this.reflector.getAllAndOverride<
      RoleUtilisateur[] | undefined
    >(ROLES_AUTORISES, [context.getHandler(), context.getClass()]);

    // 2. pas de @Roles : tout utilisateur connecté peut entrer
    if (!rolesAutorises || rolesAutorises.length === 0) {
      return true;
    }

    // 3. le rôle de l'utilisateur fait-il partie de la liste ?
    const { utilisateur } = context
      .switchToHttp()
      .getRequest<RequeteAuthentifiee>();
    if (!utilisateur || !rolesAutorises.includes(utilisateur.role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits pour cette action",
      );
    }
    return true;
  }
}
