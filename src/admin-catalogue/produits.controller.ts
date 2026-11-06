import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { StatutProduit } from '@prisma/client';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import {
  AjouterPhotoDto,
  CreerProduitDto,
  DefinirPaliersDto,
  ModifierProduitDto,
  ModifierVarianteDto,
  VarianteDto,
} from './dto/produit.dto.js';
import { ProduitsService } from './produits.service.js';

@Roles('direction')
@Controller('admin')
export class ProduitsController {
  constructor(private readonly produits: ProduitsService) {}

  // GET /admin/produits?statut=propose&categorie=1&marque=2
  @Get('produits')
  lister(
    @Query('statut', new ParseEnumPipe(StatutProduit, { optional: true }))
    statut?: StatutProduit,
    @Query('categorie', new ParseIntPipe({ optional: true }))
    categorie?: number,
    @Query('marque', new ParseIntPipe({ optional: true })) marque?: number,
  ) {
    return this.produits.lister(statut, categorie, marque);
  }

  @Get('produits/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.produits.detail(id);
  }

  @Post('produits')
  creer(@Body() dto: CreerProduitDto) {
    return this.produits.creer(dto);
  }

  @Patch('produits/:id')
  modifier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModifierProduitDto,
  ) {
    return this.produits.modifier(id, dto);
  }

  @Post('produits/:id/publier')
  publier(@Param('id', ParseIntPipe) id: number) {
    return this.produits.publier(id);
  }

  @Post('produits/:id/refuser')
  refuser(@Param('id', ParseIntPipe) id: number) {
    return this.produits.refuser(id);
  }

  @Post('produits/:id/retirer')
  retirer(@Param('id', ParseIntPipe) id: number) {
    return this.produits.retirer(id);
  }

  @Post('produits/:id/variantes')
  ajouterVariante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VarianteDto,
  ) {
    return this.produits.ajouterVariante(id, dto);
  }

  @Post('produits/:id/photos')
  ajouterPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjouterPhotoDto,
  ) {
    return this.produits.ajouterPhoto(id, dto);
  }

  @Patch('variantes/:id')
  modifierVariante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModifierVarianteDto,
  ) {
    return this.produits.modifierVariante(id, dto);
  }

  @Put('variantes/:id/paliers')
  definirPaliers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirPaliersDto,
  ) {
    return this.produits.definirPaliers(id, dto);
  }
}
