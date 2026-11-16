import { Global, Module } from '@nestjs/common';
import { StockageService } from './stockage.service.js';

// Global : tous les modules qui reçoivent des photos utilisent la même consigne
@Global()
@Module({
  providers: [StockageService],
  exports: [StockageService],
})
export class FichiersModule {}
