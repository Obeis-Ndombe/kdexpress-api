import { Module } from '@nestjs/common';
import { AvoirsModule } from '../avoirs/avoirs.module.js';
import { AchatsController } from './achats.controller.js';
import { AchatsService } from './achats.service.js';

@Module({
  imports: [AvoirsModule], // pour rembourser par avoir
  controllers: [AchatsController],
  providers: [AchatsService],
})
export class AchatsModule {}
