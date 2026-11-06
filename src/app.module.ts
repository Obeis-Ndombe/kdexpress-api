import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UtilisateursModule } from './utilisateurs/utilisateurs.module.js';
import { CommandesModule } from './commandes/commandes.module.js';
import { PaiementsModule } from './paiements/paiements.module.js';
import { AvoirsModule } from './avoirs/avoirs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // lit le fichier .env
    PrismaModule,
    CatalogueModule,
    AuthModule,
    UtilisateursModule,
    CommandesModule,
    PaiementsModule,
    AvoirsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
