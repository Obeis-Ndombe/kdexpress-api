import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiProduces } from '@nestjs/swagger';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { ExpeditionService } from '../expedition/expedition.service.js';
import { lireCodeColis } from './code-colis.js';
import { PointageScanDto } from './dto/pointage-scan.dto.js';
import { EtiquettesService } from './etiquettes.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Controller()
export class EtiquettesController {
  constructor(
    private readonly etiquettes: EtiquettesService,
    private readonly expedition: ExpeditionService,
  ) {}

  // GET /colis/:id/etiquette : le PDF à imprimer et coller sur le colis
  @Roles('agent_dubai', 'direction')
  @ApiProduces('application/pdf')
  @Get('colis/:id/etiquette')
  pourColis(@Param('id', ParseIdPipe) id: number) {
    return this.etiquettes.pourColis(id);
  }

  // GET /lots/:id/etiquettes : toutes les étiquettes d'un lot dans un seul PDF
  @Roles('agent_dubai', 'direction')
  @ApiProduces('application/pdf')
  @Get('lots/:id/etiquettes')
  pourLot(@Param('id', ParseIdPipe) id: number) {
    return this.etiquettes.pourLot(id);
  }

  // POST /colis/pointage-scan : pointer le colis dont on vient de scanner le QR.
  // Mêmes règles que POST /colis/:id/pointage.
  @Roles('agent_bureau')
  @Post('colis/pointage-scan')
  @HttpCode(200)
  pointerParScan(@Body() dto: PointageScanDto) {
    return this.expedition.pointer(lireCodeColis(dto.code));
  }
}
