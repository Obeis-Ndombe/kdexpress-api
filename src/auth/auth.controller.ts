import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LIMITE_CONNEXION, LIMITE_INSCRIPTION } from '../commun/limites.js';
import { AuthService } from './auth.service.js';
import type { UtilisateurConnecte } from './auth.types.js';
import { Public } from './decorateurs/public.decorator.js';
import { Utilisateur } from './decorateurs/utilisateur-connecte.decorator.js';
import { ConnexionDto } from './dto/connexion.dto.js';
import { InscriptionDto } from './dto/inscription.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/inscription : ouverte à tous
  @Public()
  @Throttle(LIMITE_INSCRIPTION) // 10 par minute et par adresse
  @Post('inscription')
  inscrire(@Body() dto: InscriptionDto) {
    return this.authService.inscrire(dto);
  }

  // POST /auth/connexion : ouverte à tous
  // 200 et pas 201 : on ne crée rien, on vérifie une identité
  // 5 essais par minute pour un même email, 20 par adresse (voir commun/limites.ts)
  @Public()
  @Throttle(LIMITE_CONNEXION)
  @Post('connexion')
  @HttpCode(200)
  connecter(@Body() dto: ConnexionDto) {
    return this.authService.connecter(dto);
  }

  // GET /auth/moi : réservée aux utilisateurs connectés
  @Get('moi')
  moi(@Utilisateur() utilisateur: UtilisateurConnecte) {
    return this.authService.moi(utilisateur.idUtilisateur);
  }
}
