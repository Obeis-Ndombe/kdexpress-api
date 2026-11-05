import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ChargeJeton } from './charge-jeton.js';

// @UtilisateurConnecte() donne la charge du jeton déposée par AuthGuard
export const UtilisateurConnecte = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ChargeJeton =>
    context.switchToHttp().getRequest<{ utilisateur: ChargeJeton }>().utilisateur,
);