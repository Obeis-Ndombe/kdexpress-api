import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import {
  CreerCategorieDto,
  DefinirCaracteristiquesCategorieDto,
  ModifierCategorieDto,
} from './dto/categorie.dto.js';
import {
  CreerCaracteristiqueDto,
  CreerMarqueDto,
} from './dto/marque-caracteristique.dto.js';
import { ReferentielService } from './referentiel.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Roles('direction')
@Controller('admin')
export class ReferentielController {
  constructor(private readonly referentiel: ReferentielService) {}

  @Get('categories')
  listerCategories() {
    return this.referentiel.listerCategories();
  }

  @Post('categories')
  creerCategorie(@Body() dto: CreerCategorieDto) {
    return this.referentiel.creerCategorie(dto);
  }

  @Patch('categories/:id')
  modifierCategorie(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ModifierCategorieDto,
  ) {
    return this.referentiel.modifierCategorie(id, dto);
  }

  @Put('categories/:id/caracteristiques')
  definirCaracteristiques(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: DefinirCaracteristiquesCategorieDto,
  ) {
    return this.referentiel.definirCaracteristiques(id, dto);
  }

  @Get('marques')
  listerMarques() {
    return this.referentiel.listerMarques();
  }

  @Post('marques')
  creerMarque(@Body() dto: CreerMarqueDto) {
    return this.referentiel.creerMarque(dto);
  }

  @Get('caracteristiques')
  listerCaracteristiques() {
    return this.referentiel.listerCaracteristiques();
  }

  @Post('caracteristiques')
  creerCaracteristique(@Body() dto: CreerCaracteristiqueDto) {
    return this.referentiel.creerCaracteristique(dto);
  }
}
