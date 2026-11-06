import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/decorateurs/public.decorator.js';
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
}
