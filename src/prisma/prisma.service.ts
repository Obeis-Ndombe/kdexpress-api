import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // à l'ouverture de l'application, on se connecte à la base
  async onModuleInit() {
    await this.$connect();
  }

  // à l'arrêt de l'application, on ferme proprement les connexions
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
