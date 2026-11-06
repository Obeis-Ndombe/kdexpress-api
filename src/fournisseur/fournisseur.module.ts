import { Module } from '@nestjs/common';
import { AdminCatalogueModule } from '../admin-catalogue/admin-catalogue.module.js';
import { BoutiquesModule } from '../boutiques/boutiques.module.js';
import { FournisseurController } from './fournisseur.controller.js';
import { FournisseurService } from './fournisseur.service.js';

@Module({
  imports: [AdminCatalogueModule, BoutiquesModule],
  controllers: [FournisseurController],
  providers: [FournisseurService],
})
export class FournisseurModule {}
