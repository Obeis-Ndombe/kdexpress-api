
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // à l'ouverture de l'application, on se connecte à la base
  async onModuleInit() {
    await this.$connect();
  }
}