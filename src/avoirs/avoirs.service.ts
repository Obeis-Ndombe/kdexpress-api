import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrediterAvoirDto } from './dto/crediter-avoir.dto.js';

type Decimal = Prisma.Decimal;

// « tx » : soit la connexion normale, soit la transaction en cours d'un autre service
type Connexion = Prisma.TransactionClient;

// Les avoirs : un carnet de compte par client. + crédit, − utilisation. Solde = la somme.
@Injectable()
export class AvoirsService {
  constructor(private readonly prisma: PrismaService) {}

  // Le solde d'un client (le même calcul que la vue SQL v_solde_avoir)
  async solde(idClient: number, tx: Connexion = this.prisma): Promise<Decimal> {
    const somme = await tx.operationAvoir.aggregate({
      where: { idClient },
      _sum: { montantUsd: true },
    });
    return somme._sum.montantUsd ?? new Prisma.Decimal(0); // aucune opération = 0
  }

  // Le solde et le carnet d'un client, du plus récent au plus ancien
  async historique(idClient: number) {
    const client = await this.prisma.utilisateur.findUnique({
      where: { idUtilisateur: idClient },
      select: { idUtilisateur: true, nom: true, prenom: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${idClient} introuvable`);
    }

    const [solde, operations] = await Promise.all([
      this.solde(idClient),
      this.prisma.operationAvoir.findMany({
        where: { idClient },
        orderBy: { idOperationAvoir: 'desc' },
        include: { commande: { select: { numeroCommande: true } } },
      }),
    ]);

    return {
      client,
      soldeUsd: solde.toFixed(2),
      operations: operations.map((o) => ({
        date: o.dateOperation,
        montantUsd: o.montantUsd.toFixed(2), // positif = crédit, négatif = utilisation
        motif: o.motifOperation,
        commande: o.commande?.numeroCommande ?? null,
      })),
    };
  }

  // La direction crédite un client
  async crediter(dto: CrediterAvoirDto) {
    const montant = new Prisma.Decimal(dto.montantUsd);
    if (montant.lte(0)) {
      throw new BadRequestException('Le montant doit être supérieur à 0');
    }

    // 1. seul un client ou un revendeur a un carnet d'avoir
    const client = await this.prisma.utilisateur.findUnique({
      where: { idUtilisateur: dto.idClient },
      select: { roleUtilisateur: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${dto.idClient} introuvable`);
    }
    if (
      client.roleUtilisateur !== 'client' &&
      client.roleUtilisateur !== 'revendeur'
    ) {
      throw new BadRequestException(
        'Seul un client ou un revendeur peut recevoir un avoir',
      );
    }

    // 2. la commande indiquée doit être une commande de CE client
    if (dto.idCommande) {
      const commande = await this.prisma.commande.findFirst({
        where: { idCommande: dto.idCommande, idClient: dto.idClient },
        select: { idCommande: true },
      });
      if (!commande) {
        throw new BadRequestException(
          `La commande ${dto.idCommande} n'appartient pas au client ${dto.idClient}`,
        );
      }
    }

    const operation = await this.prisma.operationAvoir.create({
      data: {
        idClient: dto.idClient,
        idCommande: dto.idCommande,
        montantUsd: montant,
        motifOperation: dto.motif,
      },
    });

    return {
      idOperationAvoir: operation.idOperationAvoir,
      date: operation.dateOperation,
      montantUsd: operation.montantUsd.toFixed(2),
      motif: operation.motifOperation,
      soldeUsd: (await this.solde(dto.idClient)).toFixed(2),
    };
  }

  // Un crédit automatique (ex. article introuvable remboursé), DANS la transaction de l'appelant
  async ajouterCredit(
    idClient: number,
    montant: Decimal,
    motif: string,
    idCommande: number,
    tx: Connexion,
  ) {
    return tx.operationAvoir.create({
      data: {
        idClient,
        idCommande,
        montantUsd: montant,
        motifOperation: motif,
      },
    });
  }

  // Une utilisation de l'avoir : appelée par les paiements, DANS leur transaction
  async debiter(
    idClient: number,
    montant: Decimal,
    motif: string,
    idCommande: number,
    tx: Connexion,
  ) {
    return tx.operationAvoir.create({
      data: {
        idClient,
        idCommande,
        montantUsd: montant.neg(),
        motifOperation: motif,
      },
    });
  }
}
