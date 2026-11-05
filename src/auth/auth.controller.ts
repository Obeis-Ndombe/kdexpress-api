import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import type { ChargeJeton } from './charge-jeton.js';
import { ConnexionDto } from './dto/connexion.dto.js';
import { InscriptionDto } from './dto/inscription.dto.js';
import { UtilisateurConnecte } from './utilisateur-connecte.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('inscription')
  inscrire(@Body() dto: InscriptionDto) {
    return this.authService.inscrire(dto);
  }

  @Post('connexion')
  @HttpCode(HttpStatus.OK) // un POST répond 201 par défaut ; ici rien n'est créé
  connecter(@Body() dto: ConnexionDto) {
    return this.authService.connecter(dto);
  }

  @Get('moi')
  @UseGuards(AuthGuard) // route protégée
  moi(@UtilisateurConnecte() utilisateur: ChargeJeton) {
    return this.authService.moi(utilisateur.sub);
  }
}