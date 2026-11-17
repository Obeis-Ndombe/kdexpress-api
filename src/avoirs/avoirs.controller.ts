import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { AvoirsService } from './avoirs.service.js';
import { CrediterAvoirDto } from './dto/crediter-avoir.dto.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Controller('avoirs')
export class AvoirsController {
  constructor(private readonly avoirsService: AvoirsService) {}

  // GET /avoirs/moi : mon solde et mon carnet
  @Roles('client', 'revendeur')
  @Get('moi')
  moi(
    @Utilisateur() utilisateur: UtilisateurConnecte,
    @Query('page', new ParseIdPipe({ optional: true })) page?: number,
  ) {
    return this.avoirsService.historique(utilisateur.idUtilisateur, page);
  }

  // GET /avoirs?client=12 : le bureau consulte le carnet d'un client
  @Roles('agent_bureau', 'direction')
  @Get()
  duClient(
    @Query('client', ParseIdPipe) idClient: number,
    @Query('page', new ParseIdPipe({ optional: true })) page?: number,
  ) {
    return this.avoirsService.historique(idClient, page);
  }

  // POST /avoirs : la direction crédite un client
  @Roles('direction')
  @Post()
  crediter(@Body() dto: CrediterAvoirDto) {
    return this.avoirsService.crediter(dto);
  }
}
