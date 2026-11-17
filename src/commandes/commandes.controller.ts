import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Public } from '../auth/decorateurs/public.decorator.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { AnnulationService } from './annulation.service.js';
import { CommandesService } from './commandes.service.js';
import { AnnulerCommandeDto } from './dto/annuler-commande.dto.js';
import { DemandeCommandeDto } from './dto/demande-commande.dto.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

// Ceux qui suivent des commandes : les clients (les leurs) et le personnel (toutes)
const ROLES_SUIVI = [
  'client',
  'revendeur',
  'agent_dubai',
  'agent_bureau',
  'direction',
] as const;

@Controller('commandes')
export class CommandesController {
  constructor(
    private readonly commandesService: CommandesService,
    private readonly annulation: AnnulationService,
  ) {}

  // POST /commandes/devis : ouvert à tous, un visiteur peut voir ce que coûte son panier
  @Public()
  @Post('devis')
  @HttpCode(200) // on calcule, on ne crée rien
  devis(@Body() dto: DemandeCommandeDto) {
    return this.commandesService.devis(dto);
  }

  // POST /commandes : seuls les clients et les revendeurs passent commande
  @Roles('client', 'revendeur')
  @Post()
  creer(
    @Body() dto: DemandeCommandeDto,
    @Utilisateur() client: UtilisateurConnecte,
  ) {
    return this.commandesService.creer(dto, client.idUtilisateur);
  }

  // GET /commandes?page=2  (personnel : ?client=12 pour filtrer)
  @Roles(...ROLES_SUIVI)
  @Get()
  lister(
    @Utilisateur() utilisateur: UtilisateurConnecte,
    @Query('page', new ParseIdPipe({ optional: true })) page?: number,
    @Query('client', new ParseIdPipe({ optional: true })) idClient?: number,
  ) {
    return this.commandesService.lister(utilisateur, page, idClient);
  }

  // GET /commandes/:id
  @Roles(...ROLES_SUIVI)
  @Get(':id')
  detail(
    @Param('id', ParseIdPipe) idCommande: number,
    @Utilisateur() utilisateur: UtilisateurConnecte,
  ) {
    return this.commandesService.detail(idCommande, utilisateur);
  }

  // POST /commandes/:id/annuler : la direction ; le client pour SA commande pas encore payée
  @Roles('direction', 'client', 'revendeur')
  @Post(':id/annuler')
  @HttpCode(200)
  annuler(
    @Param('id', ParseIdPipe) idCommande: number,
    @Body() dto: AnnulerCommandeDto,
    @Utilisateur() utilisateur: UtilisateurConnecte,
  ) {
    return this.annulation.annuler(idCommande, dto.motif, utilisateur);
  }
}
