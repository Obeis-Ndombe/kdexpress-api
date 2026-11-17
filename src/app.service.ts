import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  // La réponse de GET / : l'hébergeur s'en sert pour savoir si l'API est en vie.
  // Une API qui répond mais dont la base est tombée n'est pas « en vie » : 503.
  async sante() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        nom: 'KDExpress API',
        statut: 'indisponible',
        base: 'injoignable',
      });
    }
    return { nom: 'KDExpress API', statut: 'ok', base: 'ok' };
  }
}
