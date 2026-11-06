import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Public } from '../auth/decorateurs/public.decorator.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { CommandesService } from './commandes.service.js';
import { DemandeCommandeDto } from './dto/demande-commande.dto.js';

@Controller('commandes')
export class CommandesController {
  constructor(private readonly commandesService: CommandesService) {}

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
}
