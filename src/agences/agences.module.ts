import { Module } from '@nestjs/common';
import { AgencesController } from './agences.controller.js';
import { AgencesService } from './agences.service.js';

@Module({
  controllers: [AgencesController],
  providers: [AgencesService],
})
export class AgencesModule {}
