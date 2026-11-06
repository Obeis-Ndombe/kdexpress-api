import { Module } from '@nestjs/common';
import {
  ColisController,
  ExpeditionController,
  LotsController,
} from './expedition.controller.js';
import { ExpeditionService } from './expedition.service.js';

@Module({
  controllers: [ExpeditionController, ColisController, LotsController],
  providers: [ExpeditionService],
})
export class ExpeditionModule {}
