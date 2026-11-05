import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  getEtapes() {
    return this.prisma.etapeCommande.findMany({ orderBy: { ordreEtape: 'asc' } });
  }
}
