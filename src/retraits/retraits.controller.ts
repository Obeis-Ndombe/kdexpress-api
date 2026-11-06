import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { RemettreDto } from './dto/remettre.dto.js';
import { RetraitsService } from './retraits.service.js';

@Controller('retraits')
export class RetraitsController {
  constructor(private readonly retraits: RetraitsService) {}

  // GET /retraits/:code : vérifier avant de remettre
  @Roles('agent_bureau', 'direction')
  @Get(':code')
  verifier(@Param('code') code: string) {
    return this.retraits.verifier(code);
  }

  // POST /retraits : remettre les colis au client
  @Roles('agent_bureau')
  @Post()
  remettre(
    @Body() dto: RemettreDto,
    @Utilisateur() agent: UtilisateurConnecte,
  ) {
    return this.retraits.remettre(dto.codeRetrait, agent);
  }
}
