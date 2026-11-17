import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { AchatsService } from './achats.service.js';
import { EnregistrerAchatDto } from './dto/enregistrer-achat.dto.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Controller('achats')
export class AchatsController {
  constructor(private readonly achatsService: AchatsService) {}

  // GET /achats/a-faire : la liste d'achats de l'équipe de Dubaï
  @Roles('agent_dubai', 'direction')
  @Get('a-faire')
  aFaire() {
    return this.achatsService.aFaire();
  }

  // POST /achats : un achat fait dans une boutique
  @Roles('agent_dubai')
  @Post()
  acheter(
    @Body() dto: EnregistrerAchatDto,
    @Utilisateur() agent: UtilisateurConnecte,
  ) {
    return this.achatsService.acheter(dto, agent);
  }

  // POST /achats/lignes/:id/introuvable : l'article n'est trouvé nulle part
  @Roles('agent_dubai')
  @Post('lignes/:id/introuvable')
  @HttpCode(200) // on change un statut, on ne crée rien
  introuvable(@Param('id', ParseIdPipe) idLigneCommande: number) {
    return this.achatsService.introuvable(idLigneCommande);
  }

  // POST /achats/lignes/:id/rembourser : la direction rembourse par un avoir
  @Roles('direction')
  @Post('lignes/:id/rembourser')
  @HttpCode(200)
  rembourser(@Param('id', ParseIdPipe) idLigneCommande: number) {
    return this.achatsService.rembourser(idLigneCommande);
  }
}
