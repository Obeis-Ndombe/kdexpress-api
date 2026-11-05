import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CatalogueService } from './catalogue.service.js';

@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  // @Get('categories') -> GET /catalogue/categories
  // Affiche la liste des catégories de produits
  @Get('categories')
  listerCategories() {
    return this.catalogueService.listerCategories();
  }

  // @Get('produits') -> GET /catalogue/produits?categorie=1&marque=2
  // Affiche la liste des produits, éventuellement filtrée par catégorie et/ou marque.
  // ParseIntPipe transforme "2" en 2, et répond 400 si on envoie "abc".
  // optional: true -> le filtre peut être absent.
  @Get('produits')
  listerProduits(
    //new ParseIntPipe({ optional: true }) permet de rendre le paramètre optionnel 
    // et de le convertir en nombre entier si présent. 
    // Si le paramètre est absent, il sera undefined.
    @Query('categorie', new ParseIntPipe({ optional: true })) idCategorie?: number,
    @Query('marque', new ParseIntPipe({ optional: true })) idMarque?: number,
  ) {
    return this.catalogueService.listerProduits(idCategorie, idMarque);
  }

  // @Get('produits/:id') -> GET /catalogue/produits/123
  // Affiche le détail d'un produit.
  @Get('produits/:id')
  detailProduit(@Param('id', ParseIntPipe) idProduit: number) {
    return this.catalogueService.detailProduit(idProduit);
  }
}