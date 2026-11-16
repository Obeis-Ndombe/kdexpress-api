import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { ModifierParametresDto } from './dto/modifier-parametres.dto.js';
import { ParametresService } from './parametres.service.js';

@Roles('direction')
@Controller('admin/parametres')
export class ParametresController {
  constructor(private readonly parametres: ParametresService) {}

  @Get()
  lister() {
    return this.parametres.lister();
  }

  @Patch()
  modifier(
    @Body() dto: ModifierParametresDto,
    @Utilisateur() auteur: UtilisateurConnecte,
  ) {
    return this.parametres.modifier(dto, auteur);
  }
}
