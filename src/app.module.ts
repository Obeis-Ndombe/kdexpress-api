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
import { BoutiquesModule } from './boutiques/boutiques.module.js';
import { AchatsModule } from './achats/achats.module.js';
import { AgencesModule } from './agences/agences.module.js';
import { ExpeditionModule } from './expedition/expedition.module.js';
import { RetraitsModule } from './retraits/retraits.module.js';
import { AvisModule } from './avis/avis.module.js';
import { AdminCatalogueModule } from './admin-catalogue/admin-catalogue.module.js';
import { FournisseurModule } from './fournisseur/fournisseur.module.js';
import { FichiersModule } from './fichiers/fichiers.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // lit le fichier .env
    PrismaModule,
    FichiersModule,
    CatalogueModule,
    AuthModule,
    UtilisateursModule,
    CommandesModule,
    PaiementsModule,
    AvoirsModule,
    BoutiquesModule,
    AchatsModule,
    AgencesModule,
    ExpeditionModule,
    RetraitsModule,
    AvisModule,
    AdminCatalogueModule,
    FournisseurModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
