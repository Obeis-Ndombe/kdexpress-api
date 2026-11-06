import { Module } from '@nestjs/common';
import { BoutiquesController } from './boutiques.controller.js';
import { BoutiquesService } from './boutiques.service.js';
import { GestionBoutiquesController } from './gestion-boutiques.controller.js';
import { GestionBoutiquesService } from './gestion-boutiques.service.js';
import { OffresService } from './offres.service.js';

@Module({
  controllers: [BoutiquesController, GestionBoutiquesController],
  providers: [BoutiquesService, GestionBoutiquesService, OffresService],
  exports: [OffresService], // le fournisseur tient ses offres avec
})
export class BoutiquesModule {}
