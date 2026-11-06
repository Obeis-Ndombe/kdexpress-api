import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { BoutiquesService } from './boutiques.service.js';
import { CreerBoutiqueDto } from './dto/creer-boutique.dto.js';

@Roles('agent_dubai', 'direction')
@Controller('boutiques')
export class BoutiquesController {
  constructor(private readonly boutiquesService: BoutiquesService) {}

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
}
