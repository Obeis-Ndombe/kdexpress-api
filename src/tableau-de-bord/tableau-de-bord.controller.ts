import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { PeriodeDto } from './dto/periode.dto.js';
import { TableauDeBordService } from './tableau-de-bord.service.js';

@Roles('direction')
@Controller('admin/tableau-de-bord')
export class TableauDeBordController {
  constructor(private readonly tableauDeBord: TableauDeBordService) {}

  // GET /admin/tableau-de-bord?du=2026-11-01&au=2026-11-30 (par défaut : les 30 derniers jours)
  @Get()
  tableau(@Query() periode: PeriodeDto) {
    return this.tableauDeBord.tableau(periode.du, periode.au);
  }
}
