import { Module } from '@nestjs/common';
import { CommandesController } from './commandes.controller.js';
import { CommandesService } from './commandes.service.js';
import { TarificationService } from './tarification.service.js';

@Module({
  controllers: [CommandesController],
  providers: [CommandesService, TarificationService],
})
export class CommandesModule {}
