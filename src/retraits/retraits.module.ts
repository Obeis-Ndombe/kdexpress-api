import { Module } from '@nestjs/common';
import { RetraitsController } from './retraits.controller.js';
import { RetraitsService } from './retraits.service.js';

@Module({
  controllers: [RetraitsController],
  providers: [RetraitsService],
})
export class RetraitsModule {}
