import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { ChangerStatutDto } from './dto/changer-statut.dto.js';
import { CreerUtilisateurDto } from './dto/creer-utilisateur.dto.js';
import { UtilisateursService } from './utilisateurs.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Roles('direction') // toutes les routes de ce controller : direction seulement
@Controller('utilisateurs')
export class UtilisateursController {
  constructor(private readonly utilisateursService: UtilisateursService) {}

  // GET /utilisateurs?role=agent_dubai&page=2 (50 par page)
  @Get()
  lister(
    @Query('role', new ParseEnumPipe(RoleUtilisateur, { optional: true }))
    role?: RoleUtilisateur,
    @Query('page', new ParseIdPipe({ optional: true })) page?: number,
  ) {
    return this.utilisateursService.lister(role, page);
  }

  // POST /utilisateurs
  @Post()
  creer(@Body() dto: CreerUtilisateurDto) {
    return this.utilisateursService.creer(dto);
  }

  // PATCH /utilisateurs/:id/statut
  @Patch(':id/statut')
  changerStatut(
    @Param('id', ParseIdPipe) idUtilisateur: number,
    @Body() dto: ChangerStatutDto,
    @Utilisateur() moi: UtilisateurConnecte,
  ) {
    return this.utilisateursService.changerStatut(
      idUtilisateur,
      dto.statut,
      moi.idUtilisateur,
    );
  }
}
