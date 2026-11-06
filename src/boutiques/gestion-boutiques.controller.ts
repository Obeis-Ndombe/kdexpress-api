import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { RattacherGestionnaireDto } from './dto/rattacher-gestionnaire.dto.js';
import { GestionBoutiquesService } from './gestion-boutiques.service.js';

@Roles('direction')
@Controller('admin/boutiques')
export class GestionBoutiquesController {
  constructor(private readonly gestion: GestionBoutiquesService) {}

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.gestion.detail(id);
  }

  @Post(':id/gestionnaires')
  rattacher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RattacherGestionnaireDto,
  ) {
    return this.gestion.rattacher(id, dto);
  }

  @Delete(':id/gestionnaires/:idUtilisateur')
  detacher(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUtilisateur', ParseIntPipe) idUtilisateur: number,
  ) {
    return this.gestion.detacher(id, idUtilisateur);
  }

  @Post(':id/verifier')
  verifier(@Param('id', ParseIntPipe) id: number) {
    return this.gestion.verifier(id);
  }

  @Post(':id/refuser')
  refuser(@Param('id', ParseIntPipe) id: number) {
    return this.gestion.refuser(id);
  }
}
