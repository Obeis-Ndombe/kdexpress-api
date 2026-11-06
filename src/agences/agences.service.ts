import { ConflictException, Injectable } from '@nestjs/common';
import { AgenceTransport, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreerAgenceDto } from './dto/creer-agence.dto.js';

@Injectable()
export class AgencesService {
  constructor(private readonly prisma: PrismaService) {}

  async lister() {
    const agences = await this.prisma.agenceTransport.findMany({
      orderBy: { nomAgence: 'asc' },
    });
    return agences.map((a) => this.presenter(a));
  }

  async creer(dto: CreerAgenceDto) {
    try {
      const agence = await this.prisma.agenceTransport.create({
        data: {
          nomAgence: dto.nom,
          telephoneAgence: dto.telephone,
          tarifKgUsd: dto.tarifKgUsd
            ? new Prisma.Decimal(dto.tarifKgUsd)
            : undefined,
        },
      });
      return this.presenter(agence);
    } catch (erreur) {
      // P2002 : le nom de l'agence est unique
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === 'P2002'
      ) {
        throw new ConflictException(`L'agence « ${dto.nom} » existe déjà`);
      }
      throw erreur;
    }
  }

  // le tarif toujours avec 2 décimales : "8.50"
  private presenter(a: AgenceTransport) {
    return {
      idAgenceTransport: a.idAgenceTransport,
      nom: a.nomAgence,
      telephone: a.telephoneAgence,
      tarifKgUsd: a.tarifKgUsd?.toFixed(2) ?? null,
    };
  }
}
