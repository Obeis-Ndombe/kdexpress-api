import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // Démarre l'application complète : il faut la base de données du fichier .env
  it('GET / répond sans jeton', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ nom: 'KDExpress API', statut: 'ok', base: 'ok' });
  });

  it('une route protégée sans jeton répond 401', () => {
    return request(app.getHttpServer()).get('/avoirs/moi').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
