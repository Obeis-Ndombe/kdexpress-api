import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { Utilisateur } from '../auth/decorateurs/utilisateur-connecte.decorator.js';
import { EnvoiPhoto } from '../fichiers/envoi-photo.decorator.js';
import type { PhotoRecue } from '../fichiers/images.js';
import { CreerColisDto, PeserColisDto } from './dto/creer-colis.dto.js';
import {
  AjouterColisDto,
  ArriveeLotDto,
  CreerLotDto,
  DepartLotDto,
} from './dto/lot.dto.js';
import { ExpeditionService } from './expedition.service.js';
import { PhotosColisService } from './photos-colis.service.js';

// GET /expedition/a-emballer
@Controller('expedition')
export class ExpeditionController {
  constructor(private readonly expedition: ExpeditionService) {}

  @Roles('agent_dubai', 'direction')
  @Get('a-emballer')
  aEmballer() {
    return this.expedition.aEmballer();
  }
}

// Les colis : préparés à Dubaï, pointés à Kinshasa
@Controller('colis')
export class ColisController {
  constructor(
    private readonly expedition: ExpeditionService,
    private readonly photos: PhotosColisService,
  ) {}

  // POST /colis
  @Roles('agent_dubai')
  @Post()
  creer(@Body() dto: CreerColisDto) {
    return this.expedition.creerColis(dto);
  }

  // PATCH /colis/:id
  @Roles('agent_dubai')
  @Patch(':id')
  peser(
    @Param('id', ParseIntPipe) idColis: number,
    @Body() dto: PeserColisDto,
  ) {
    return this.expedition.peser(idColis, dto.poidsReelKg);
  }

  // POST /colis/:id/photos : multipart/form-data, la photo dans le champ « photo »
  @Roles('agent_dubai')
  @Post(':id/photos')
  @EnvoiPhoto()
  ajouterPhoto(
    @Param('id', ParseIntPipe) idColis: number,
    @UploadedFile() photo?: PhotoRecue,
  ) {
    return this.photos.ajouter(idColis, photo);
  }

  // GET /colis/:id/photos/:idPhoto : l'image (personnel, ou client du colis)
  @Roles('agent_dubai', 'agent_bureau', 'direction', 'client', 'revendeur')
  @Get(':id/photos/:idPhoto')
  lirePhoto(
    @Param('id', ParseIntPipe) idColis: number,
    @Param('idPhoto', ParseIntPipe) idPhoto: number,
    @Utilisateur() utilisateur: UtilisateurConnecte,
  ) {
    return this.photos.lire(idColis, idPhoto, utilisateur);
  }

  // POST /colis/:id/pointage
  @Roles('agent_bureau')
  @Post(':id/pointage')
  @HttpCode(200) // on change un statut, on ne crée rien
  pointer(@Param('id', ParseIntPipe) idColis: number) {
    return this.expedition.pointer(idColis);
  }
}

// Les lots : la palette confiée à l'agence de transport
@Controller('lots')
export class LotsController {
  constructor(private readonly expedition: ExpeditionService) {}

  // GET /lots
  @Roles('agent_dubai', 'agent_bureau', 'direction')
  @Get()
  lister() {
    return this.expedition.listerLots();
  }

  // GET /lots/:id
  @Roles('agent_dubai', 'agent_bureau', 'direction')
  @Get(':id')
  detail(@Param('id', ParseIntPipe) idLot: number) {
    return this.expedition.detailLot(idLot);
  }

  // POST /lots
  @Roles('agent_dubai')
  @Post()
  creer(@Body() dto: CreerLotDto) {
    return this.expedition.creerLot(dto.idAgenceTransport, dto.colis);
  }

  // POST /lots/:id/colis
  @Roles('agent_dubai')
  @Post(':id/colis')
  @HttpCode(200)
  ajouter(
    @Param('id', ParseIntPipe) idLot: number,
    @Body() dto: AjouterColisDto,
  ) {
    return this.expedition.ajouterAuLot(idLot, dto.colis);
  }

  // POST /lots/:id/depart
  @Roles('agent_dubai')
  @Post(':id/depart')
  @HttpCode(200)
  depart(@Param('id', ParseIntPipe) idLot: number, @Body() dto: DepartLotDto) {
    return this.expedition.depart(idLot, dto);
  }

  // POST /lots/:id/arrivee
  @Roles('agent_bureau', 'direction')
  @Post(':id/arrivee')
  @HttpCode(200)
  arrivee(
    @Param('id', ParseIntPipe) idLot: number,
    @Body() dto: ArriveeLotDto,
  ) {
    return this.expedition.arrivee(idLot, dto);
  }
}
