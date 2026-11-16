import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LimitesGuard } from '../commun/limites.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    // le secret et la durée du jeton viennent du fichier .env
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(config.get('JWT_DUREE_SECONDES', 86400)),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // APP_GUARD : les gardes s'appliquent à TOUTES les routes, dans cet ordre
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1. qui es-tu ?
    { provide: APP_GUARD, useClass: RolesGuard }, // 2. as-tu le droit ?
    { provide: APP_GUARD, useClass: LimitesGuard }, // 3. pas trop souvent ?
  ],
})
export class AuthModule {}
