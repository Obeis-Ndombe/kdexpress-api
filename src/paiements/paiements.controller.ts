import { Body, Controller, Param, Post } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { EnregistrerPaiementDto } from './dto/enregistrer-paiement.dto.js';
import { PaiementsService } from './paiements.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Controller('commandes')
export class PaiementsController {
  constructor(private readonly paiementsService: PaiementsService) {}

  // POST /commandes/:id/paiements : le bureau enregistre un paiement reçu ;
  // un client peut aussi payer SA commande avec son avoir
  @Roles('agent_bureau', 'direction', 'client', 'revendeur')
  @Post(':id/paiements')
  enregistrer(
    @Param('id', ParseIdPipe) idCommande: number,
    @Body() dto: EnregistrerPaiementDto,
    @Utilisateur() utilisateur: UtilisateurConnecte,
  ) {
    return this.paiementsService.enregistrer(idCommande, dto, utilisateur);
  }
}
