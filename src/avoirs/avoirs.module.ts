import { Module } from '@nestjs/common';
import { AvoirsController } from './avoirs.controller.js';
import { AvoirsService } from './avoirs.service.js';

@Module({
  controllers: [AvoirsController],
  providers: [AvoirsService],
  exports: [AvoirsService], // les paiements s'en servent
})
export class AvoirsModule {}
