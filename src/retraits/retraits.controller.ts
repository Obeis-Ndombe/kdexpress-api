import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { LIMITE_CODE_RETRAIT } from '../commun/limites.js';
import { RemettreDto } from './dto/remettre.dto.js';
import { RetraitsService } from './retraits.service.js';

// 20 codes par minute et par agent : un code de retrait ne se devine pas par essais
@Throttle(LIMITE_CODE_RETRAIT)
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
