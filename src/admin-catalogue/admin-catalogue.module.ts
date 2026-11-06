import { Module } from '@nestjs/common';
import { ProduitsController } from './produits.controller.js';
import { ProduitsService } from './produits.service.js';
import { ReferentielController } from './referentiel.controller.js';
import { ReferentielService } from './referentiel.service.js';

@Module({
  controllers: [ReferentielController, ProduitsController],
  providers: [ReferentielService, ProduitsService],
  exports: [ProduitsService], // le fournisseur crée ses propositions avec
})
export class AdminCatalogueModule {}
