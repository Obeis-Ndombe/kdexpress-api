import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorateurs/roles.decorator.js';
import { CreerColisDto, PeserColisDto } from './dto/creer-colis.dto.js';
import {
  AjouterColisDto,
  ArriveeLotDto,
  CreerLotDto,
  DepartLotDto,
} from './dto/lot.dto.js';
import { PhotoColisDto } from './dto/photo-colis.dto.js';
import { ExpeditionService } from './expedition.service.js';

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
  constructor(private readonly expedition: ExpeditionService) {}

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

  // POST /colis/:id/photos
  @Roles('agent_dubai')
  @Post(':id/photos')
  ajouterPhoto(
    @Param('id', ParseIntPipe) idColis: number,
    @Body() dto: PhotoColisDto,
  ) {
    return this.expedition.ajouterPhoto(idColis, dto.fichier);
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
