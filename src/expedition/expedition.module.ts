import { Module } from '@nestjs/common';
import {
  ColisController,
  ExpeditionController,
  LotsController,
} from './expedition.controller.js';
import { ExpeditionService } from './expedition.service.js';
import { PhotosColisService } from './photos-colis.service.js';

@Module({
  controllers: [ExpeditionController, ColisController, LotsController],
  providers: [ExpeditionService, PhotosColisService],
  exports: [ExpeditionService], // les étiquettes pointent un colis par son QR
})
export class ExpeditionModule {}
