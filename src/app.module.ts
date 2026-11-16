import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { verifierConfiguration } from './commun/configuration.js';
import { ErreursFilter } from './commun/erreurs.filter.js';
import { LIMITES } from './commun/limites.js';
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
import { EtiquettesModule } from './etiquettes/etiquettes.module.js';

@Module({
  imports: [
    // lit le fichier .env et le contrôle : l'API refuse de démarrer s'il est incomplet
    ConfigModule.forRoot({ isGlobal: true, validate: verifierConfiguration }),
    ThrottlerModule.forRoot(LIMITES), // les limites d'essais (voir commun/limites.ts)
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
    EtiquettesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: ErreursFilter }],
})
export class AppModule {}
