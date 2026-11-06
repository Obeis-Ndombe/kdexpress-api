import { Module } from '@nestjs/common';
import { AvoirsModule } from '../avoirs/avoirs.module.js';
import { PaiementsController } from './paiements.controller.js';
import { PaiementsService } from './paiements.service.js';

@Module({
  imports: [AvoirsModule], // pour payer par avoir
  controllers: [PaiementsController],
  providers: [PaiementsService],
})
export class PaiementsModule {}
