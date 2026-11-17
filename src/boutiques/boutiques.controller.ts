import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { BoutiquesService } from './boutiques.service.js';
import { CreerBoutiqueDto } from './dto/creer-boutique.dto.js';
import { OffreDto } from './dto/offre.dto.js';
import { OffresService } from './offres.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Roles('agent_dubai', 'direction')
@Controller('boutiques')
export class BoutiquesController {
  constructor(
    private readonly boutiquesService: BoutiquesService,
    private readonly offresService: OffresService,
  ) {}

  // GET /boutiques
  @Get()
  lister() {
    return this.boutiquesService.lister();
  }

  // POST /boutiques
  @Post()
  creer(@Body() dto: CreerBoutiqueDto) {
    return this.boutiquesService.creer(dto);
  }

  // GET /boutiques/:id/offres : les prix notés pour cette boutique
  @Get(':id/offres')
  async offres(@Param('id', ParseIdPipe) id: number) {
    await this.boutiquesService.trouver(id);
    return this.offresService.lister(id);
  }

  // PUT /boutiques/:id/offres/:idVariante : l'agent note le prix vu en boutique.
  // Une boutique vérifiée tient elle-même ses prix : l'agent ne les écrase pas.
  @Put(':id/offres/:idVariante')
  async noterOffre(
    @Param('id', ParseIdPipe) id: number,
    @Param('idVariante', ParseIdPipe) idVariante: number,
    @Body() dto: OffreDto,
  ) {
    const boutique = await this.boutiquesService.trouver(id);
    if (boutique.statutBoutique === 'verifiee') {
      throw new BadRequestException(
        'Cette boutique tient elle-même ses prix sur KDExpress',
      );
    }
    return this.offresService.enregistrer(id, idVariante, dto);
  }
}
