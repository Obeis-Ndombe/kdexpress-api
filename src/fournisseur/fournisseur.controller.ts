import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { OffreDto } from '../boutiques/dto/offre.dto.js';
import { EnvoiPhoto } from '../fichiers/envoi-photo.decorator.js';
import type { PhotoRecue } from '../fichiers/images.js';
import {
  ModifierPropositionDto,
  PropositionProduitDto,
} from './dto/proposition-produit.dto.js';
import { FournisseurService } from './fournisseur.service.js';
import { ParseIdPipe } from '../commun/parse-id.pipe.js';

@Roles('fournisseur')
@Controller('fournisseur/boutiques')
export class FournisseurController {
  constructor(private readonly fournisseur: FournisseurService) {}

  @Get()
  mesBoutiques(@Utilisateur() u: UtilisateurConnecte) {
    return this.fournisseur.mesBoutiques(u.idUtilisateur);
  }

  @Get(':id/produits')
  mesPropositions(
    @Utilisateur() u: UtilisateurConnecte,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.fournisseur.mesPropositions(u.idUtilisateur, id);
  }

  @Post(':id/produits')
  proposer(
    @Utilisateur() u: UtilisateurConnecte,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: PropositionProduitDto,
  ) {
    return this.fournisseur.proposer(u.idUtilisateur, id, dto);
  }

  @Patch(':id/produits/:idProduit')
  modifierProposition(
    @Utilisateur() u: UtilisateurConnecte,
    @Param('id', ParseIdPipe) id: number,
    @Param('idProduit', ParseIdPipe) idProduit: number,
    @Body() dto: ModifierPropositionDto,
  ) {
    return this.fournisseur.modifierProposition(
      u.idUtilisateur,
      id,
      idProduit,
      dto,
    );
  }

  // multipart/form-data, la photo dans le champ « photo »
  @Post(':id/produits/:idProduit/photos')
  @EnvoiPhoto()
  ajouterPhoto(
    @Utilisateur() u: UtilisateurConnecte,
    @Param('id', ParseIdPipe) id: number,
    @Param('idProduit', ParseIdPipe) idProduit: number,
    @UploadedFile() photo?: PhotoRecue,
  ) {
    return this.fournisseur.ajouterPhoto(u.idUtilisateur, id, idProduit, photo);
  }

  @Get(':id/offres')
  mesOffres(
    @Utilisateur() u: UtilisateurConnecte,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.fournisseur.mesOffres(u.idUtilisateur, id);
  }

  @Put(':id/offres/:idVariante')
  enregistrerOffre(
    @Utilisateur() u: UtilisateurConnecte,
    @Param('id', ParseIdPipe) id: number,
    @Param('idVariante', ParseIdPipe) idVariante: number,
    @Body() dto: OffreDto,
  ) {
    return this.fournisseur.enregistrerOffre(
      u.idUtilisateur,
      id,
      idVariante,
      dto,
    );
  }
}
