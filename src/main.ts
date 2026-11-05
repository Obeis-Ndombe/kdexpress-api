import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
