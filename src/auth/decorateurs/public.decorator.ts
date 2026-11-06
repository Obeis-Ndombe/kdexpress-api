import { SetMetadata } from '@nestjs/common';

// L'étiquette que la garde cherche pour laisser passer sans jeton
export const ROUTE_PUBLIQUE = 'routePublique';

// @Public() sur une route ou sur tout un controller : pas besoin d'être connecté
export const Public = () => SetMetadata(ROUTE_PUBLIQUE, true);
