import { Module } from '@nestjs/common';
import { TableauDeBordController } from './tableau-de-bord.controller.js';
import { TableauDeBordService } from './tableau-de-bord.service.js';

@Module({
  controllers: [TableauDeBordController],
  providers: [TableauDeBordService],
})
export class TableauDeBordModule {}
