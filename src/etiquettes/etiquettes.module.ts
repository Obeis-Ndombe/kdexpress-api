import { Module } from '@nestjs/common';
import { ExpeditionModule } from '../expedition/expedition.module.js';
import { EtiquettesController } from './etiquettes.controller.js';
import { EtiquettesService } from './etiquettes.service.js';

@Module({
  imports: [ExpeditionModule],
  controllers: [EtiquettesController],
  providers: [EtiquettesService],
})
export class EtiquettesModule {}
