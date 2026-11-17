import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { AvisService } from './avis.service.js';
import { DonnerAvisDto } from './dto/donner-avis.dto.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

// POST /commandes/:id/avis
@Controller('commandes')
export class DonnerAvisController {
  constructor(private readonly avis: AvisService) {}

  @Roles('client', 'revendeur')
  @Post(':id/avis')
  donner(
    @Param('id', ParseIdPipe) idCommande: number,
    @Body() dto: DonnerAvisDto,
    @Utilisateur() client: UtilisateurConnecte,
  ) {
    return this.avis.donner(idCommande, dto, client);
  }
}

// GET /avis?page=2 (50 par page)
@Controller('avis')
export class AvisController {
  constructor(private readonly avis: AvisService) {}

  @Roles('direction')
  @Get()
  lister(@Query('page', new ParseIdPipe({ optional: true })) page?: number) {
    return this.avis.lister(page);
  }
}
