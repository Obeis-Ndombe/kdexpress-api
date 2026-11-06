import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { AvoirsService } from './avoirs.service.js';
import { CrediterAvoirDto } from './dto/crediter-avoir.dto.js';

@Controller('avoirs')
export class AvoirsController {
  constructor(private readonly avoirsService: AvoirsService) {}

  // GET /avoirs/moi : mon solde et mon carnet
  @Roles('client', 'revendeur')
  @Get('moi')
  moi(@Utilisateur() utilisateur: UtilisateurConnecte) {
    return this.avoirsService.historique(utilisateur.idUtilisateur);
  }

  // GET /avoirs?client=12 : le bureau consulte le carnet d'un client
  @Roles('agent_bureau', 'direction')
  @Get()
  duClient(@Query('client', ParseIntPipe) idClient: number) {
    return this.avoirsService.historique(idClient);
  }

  // POST /avoirs : la direction crédite un client
  @Roles('direction')
  @Post()
  crediter(@Body() dto: CrediterAvoirDto) {
    return this.avoirsService.crediter(dto);
  }
}
