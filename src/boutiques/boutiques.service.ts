import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreerBoutiqueDto } from './dto/creer-boutique.dto.js';

@Injectable()
export class BoutiquesService {
  constructor(private readonly prisma: PrismaService) {}

  lister() {
    return this.prisma.boutique.findMany({ orderBy: { nomBoutique: 'asc' } });
  }

  // une boutique ajoutée par l'agent est « non inscrite » : elle n'a pas de compte chez nous
  creer(dto: CreerBoutiqueDto) {
    return this.prisma.boutique.create({
      data: {
        nomBoutique: dto.nom,
        adresseBoutique: dto.adresse,
        telephoneBoutique: dto.telephone,
      },
    });
  }
}
