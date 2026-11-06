import { Module } from '@nestjs/common';
import { AvisController, DonnerAvisController } from './avis.controller.js';
import { AvisService } from './avis.service.js';

@Module({
  controllers: [DonnerAvisController, AvisController],
  providers: [AvisService],
})
export class AvisModule {}
