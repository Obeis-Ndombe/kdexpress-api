import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  // une doublure de la base : elle répond, ou elle est « tombée »
  const controleur = async (baseEnVie: boolean) => {
    const prisma = {
      $queryRaw: () =>
        baseEnVie ? Promise.resolve([1]) : Promise.reject(new Error('coupée')),
    };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return app.get<AppController>(AppController);
  };

  it('GET / répond que l’API et la base sont en vie', async () => {
    expect(await (await controleur(true)).sante()).toEqual({
      nom: 'KDExpress API',
      statut: 'ok',
      base: 'ok',
    });
  });

  it('GET / répond 503 si la base ne répond pas', async () => {
    await expect((await controleur(false)).sante()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
