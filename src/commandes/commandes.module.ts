import { Module } from '@nestjs/common';
import { AvoirsModule } from '../avoirs/avoirs.module.js';
import { AnnulationService } from './annulation.service.js';
import { CommandesController } from './commandes.controller.js';
import { CommandesService } from './commandes.service.js';
import { TarificationService } from './tarification.service.js';

@Module({
  imports: [AvoirsModule], // l'annulation rend l'argent en avoir
  controllers: [CommandesController],
  providers: [CommandesService, TarificationService, AnnulationService],
})
export class CommandesModule {}
