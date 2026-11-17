import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogueService } from './catalogue.service.js';
import { Public } from '../auth/decorateurs/public.decorator.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Public() // le catalogue se consulte sans être connecté
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  // @Get('categories') -> GET /catalogue/categories
  // Affiche la liste des catégories de produits
  @Get('categories')
  listerCategories() {
    return this.catalogueService.listerCategories();
  }

  // @Get('produits') -> GET /catalogue/produits?categorie=1&marque=2&page=2
  // Affiche la liste des produits, éventuellement filtrée par catégorie et/ou marque.
  // ParseIdPipe transforme "2" en 2, et répond 400 si on envoie "abc", "-1" ou un nombre trop grand.
  // optional: true -> le filtre peut être absent.
  @Get('produits')
  listerProduits(
    //new ParseIdPipe({ optional: true }) permet de rendre le paramètre optionnel
    // et de le convertir en nombre entier si présent.
    // Si le paramètre est absent, il sera undefined.
    @Query('categorie', new ParseIdPipe({ optional: true }))
    idCategorie?: number,
    @Query('marque', new ParseIdPipe({ optional: true })) idMarque?: number,
    @Query('page', new ParseIdPipe({ optional: true })) page?: number,
  ) {
    return this.catalogueService.listerProduits(idCategorie, idMarque, page);
  }

  // @Get('produits/:id') -> GET /catalogue/produits/123
  // Affiche le détail d'un produit.
  @Get('produits/:id')
  detailProduit(@Param('id', ParseIdPipe) idProduit: number) {
    return this.catalogueService.detailProduit(idProduit);
  }
}
