import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  LIMITE_CONNEXION,
  LIMITE_INSCRIPTION,
  LIMITE_MOT_DE_PASSE,
} from '../commun/limites.js';
import { AuthService } from './auth.service.js';
import { CompteService } from './compte.service.js';
import type { UtilisateurConnecte } from './auth.types.js';
import { Public } from './decorateurs/public.decorator.js';
import { Utilisateur } from './decorateurs/utilisateur-connecte.decorator.js';
import {
  ChangerMotDePasseDto,
  ModifierProfilDto,
  MotDePasseOublieDto,
  ReinitialiserMotDePasseDto,
} from './dto/compte.dto.js';
import { ConnexionDto } from './dto/connexion.dto.js';
import { InscriptionDto } from './dto/inscription.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly compte: CompteService,
  ) {}

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

  // PATCH /auth/moi : modifier son nom, son prénom, son téléphone
  @Patch('moi')
  modifierProfil(
    @Utilisateur() utilisateur: UtilisateurConnecte,
    @Body() dto: ModifierProfilDto,
  ) {
    return this.compte.modifierProfil(utilisateur.idUtilisateur, dto);
  }

  // POST /auth/mot-de-passe : changer son mot de passe (il faut connaître l'actuel)
  @Throttle(LIMITE_MOT_DE_PASSE)
  @Post('mot-de-passe')
  @HttpCode(200)
  changerMotDePasse(
    @Utilisateur() utilisateur: UtilisateurConnecte,
    @Body() dto: ChangerMotDePasseDto,
  ) {
    return this.compte.changerMotDePasse(utilisateur.idUtilisateur, dto);
  }

  // POST /auth/mot-de-passe-oublie : recevoir un code par e-mail
  @Public()
  @Throttle(LIMITE_MOT_DE_PASSE)
  @Post('mot-de-passe-oublie')
  @HttpCode(200)
  motDePasseOublie(@Body() dto: MotDePasseOublieDto) {
    return this.compte.demanderCode(dto.email);
  }

  // POST /auth/mot-de-passe-reinitialise : le code reçu + le nouveau mot de passe
  @Public()
  @Throttle(LIMITE_MOT_DE_PASSE)
  @Post('mot-de-passe-reinitialise')
  @HttpCode(200)
  reinitialiser(@Body() dto: ReinitialiserMotDePasseDto) {
    return this.compte.reinitialiser(dto);
  }
}
