import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { StockageService } from './fichiers/stockage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés qui ne sont pas déclarées dans le DTO
      forbidNonWhitelisted: true, // Renvoie une erreur 400 si des propriétés non autorisées sont envoyées
      transform: true, // Transforme les données reçues en instances de DTO et active les transformations configurées
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
