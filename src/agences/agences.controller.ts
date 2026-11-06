import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { AgencesService } from './agences.service.js';
import { CreerAgenceDto } from './dto/creer-agence.dto.js';

@Roles('agent_dubai', 'direction')
@Controller('agences')
export class AgencesController {
  constructor(private readonly agencesService: AgencesService) {}

  // GET /agences
  @Get()
  lister() {
    return this.agencesService.lister();
  }

  // POST /agences
  @Post()
  creer(@Body() dto: CreerAgenceDto) {
    return this.agencesService.creer(dto);
  }
}
