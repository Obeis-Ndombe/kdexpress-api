import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { EnregistrerPaiementDto } from './dto/enregistrer-paiement.dto.js';
import { PaiementsService } from './paiements.service.js';

@Controller('commandes')
export class PaiementsController {
  constructor(private readonly paiementsService: PaiementsService) {}

  // POST /commandes/:id/paiements : le personnel du bureau enregistre un paiement reçu
  @Roles('agent_bureau', 'direction')
  @Post(':id/paiements')
  enregistrer(
    @Param('id', ParseIntPipe) idCommande: number,
    @Body() dto: EnregistrerPaiementDto,
    @Utilisateur() agent: UtilisateurConnecte,
  ) {
    return this.paiementsService.enregistrer(idCommande, dto, agent);
  }
}
