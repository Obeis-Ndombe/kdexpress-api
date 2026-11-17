import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { StatutProduit } from '@prisma/client';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { EnvoiPhoto } from '../fichiers/envoi-photo.decorator.js';
import type { PhotoRecue } from '../fichiers/images.js';
import {
  CreerProduitDto,
  DefinirPaliersDto,
  ModifierProduitDto,
  ModifierVarianteDto,
  VarianteDto,
} from './dto/produit.dto.js';
import { ProduitsService } from './produits.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Roles('direction')
@Controller('admin')
export class ProduitsController {
  constructor(private readonly produits: ProduitsService) {}

  // GET /admin/produits?statut=propose&categorie=1&marque=2
  @Get('produits')
  lister(
    @Query('statut', new ParseEnumPipe(StatutProduit, { optional: true }))
    statut?: StatutProduit,
    @Query('categorie', new ParseIdPipe({ optional: true }))
    categorie?: number,
    @Query('marque', new ParseIdPipe({ optional: true })) marque?: number,
    @Query('page', new ParseIdPipe({ optional: true })) page?: number,
  ) {
    return this.produits.lister(statut, categorie, marque, page);
  }

  @Get('produits/:id')
  detail(@Param('id', ParseIdPipe) id: number) {
    return this.produits.detail(id);
  }

  @Post('produits')
  creer(@Body() dto: CreerProduitDto) {
    return this.produits.creer(dto);
  }

  @Patch('produits/:id')
  modifier(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ModifierProduitDto,
  ) {
    return this.produits.modifier(id, dto);
  }

  @Post('produits/:id/publier')
  publier(@Param('id', ParseIdPipe) id: number) {
    return this.produits.publier(id);
  }

  @Post('produits/:id/refuser')
  refuser(@Param('id', ParseIdPipe) id: number) {
    return this.produits.refuser(id);
  }

  @Post('produits/:id/retirer')
  retirer(@Param('id', ParseIdPipe) id: number) {
    return this.produits.retirer(id);
  }

  @Post('produits/:id/variantes')
  ajouterVariante(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: VarianteDto,
  ) {
    return this.produits.ajouterVariante(id, dto);
  }

  // multipart/form-data, la photo dans le champ « photo »
  @Post('produits/:id/photos')
  @EnvoiPhoto()
  ajouterPhoto(
    @Param('id', ParseIdPipe) id: number,
    @UploadedFile() photo?: PhotoRecue,
  ) {
    return this.produits.ajouterPhoto(id, photo);
  }

  @Delete('photos/:id')
  supprimerPhoto(@Param('id', ParseIdPipe) id: number) {
    return this.produits.supprimerPhoto(id);
  }

  @Patch('variantes/:id')
  modifierVariante(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ModifierVarianteDto,
  ) {
    return this.produits.modifierVariante(id, dto);
  }

  @Put('variantes/:id/paliers')
  definirPaliers(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: DefinirPaliersDto,
  ) {
    return this.produits.definirPaliers(id, dto);
  }
}
