import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import {
  docsActives,
  EN_PRODUCTION,
  originesAutorisees,
} from './commun/configuration.js';
import { installerDocumentation } from './commun/documentation.js';
import { ProfondeurPipe } from './commun/profondeur.pipe.js';
import { StockageService } from './fichiers/stockage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derrière le proxy d'un hébergeur, la vraie adresse du client est dans un en-tête.
  // Sans ce réglage, tous les clients sembleraient venir de la même adresse (celle du proxy)
  // et se bloqueraient les uns les autres dans les limites d'essais.
  app.set('trust proxy', Number(process.env.PROXYS_DE_CONFIANCE ?? 0));

  // En-têtes de sécurité recommandés ; les photos restent affichables depuis les sites des applis
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Quels sites web ont le droit d'appeler l'API depuis un navigateur.
  // En développement, sans liste : tous. En production, la liste est obligatoire.
  const origines = originesAutorisees(process.env);
  app.enableCors({
    origin: origines.length > 0 ? origines : !EN_PRODUCTION(),
  });

  // À l'arrêt (redémarrage, mise à jour), on termine les requêtes en cours avant de fermer
  app.enableShutdownHooks();

  // Les photos de produits sont publiques, comme le catalogue : /fichiers/produits/xxx.webp
  // (les photos de colis, privées, passent par une route protégée)
  app.useStaticAssets(app.get(StockageService).dossier('produits'), {
    prefix: '/fichiers/produits/',
    index: false,
    dotfiles: 'deny',
    maxAge: '30d', // un nom de fichier ne sert qu'une fois : le navigateur peut le garder
    immutable: true,
  });

  // Vérifie automatiquement chaque corps de requête avec les règles des DTO
  app.useGlobalPipes(
    new ProfondeurPipe(), // d'abord : refuse les corps imbriqués sur des milliers de niveaux
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés qui ne sont pas déclarées dans le DTO
      forbidNonWhitelisted: true, // Renvoie une erreur 400 si des propriétés non autorisées sont envoyées
      transform: true, // Transforme les données reçues en instances de DTO et active les transformations configurées
    }),
  );

  // La documentation /docs : en développement, ou en production si DOCS_ACTIVES=true
  if (docsActives(process.env)) {
    installerDocumentation(app);
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
