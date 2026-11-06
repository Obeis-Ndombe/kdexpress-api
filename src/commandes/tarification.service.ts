import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { LigneDemandeDto } from './dto/demande-commande.dto.js';

const D = Prisma.Decimal; // raccourci : D('10') = un Decimal qui vaut 10
type Decimal = Prisma.Decimal;

// Une ligne chiffrée, prête à être affichée ou enregistrée
export interface LigneChiffree {
  idVariante: number;
  produit: string;
  variante: string;
  quantite: number;
  prixUnitaireAed: Decimal; // après palier
  poidsUnitaireKg: Decimal;
  sousTotalAed: Decimal;
}

// Le résultat complet d'un calcul de prix
export interface Chiffrage {
  tauxChangeAedUsd: Decimal;
  lignes: LigneChiffree[];
  articlesAed: Decimal;
  articlesUsd: Decimal;
  poidsTotalKg: Decimal;
  fraisTransportUsd: Decimal;
  fraisServiceUsd: Decimal;
}

// Le calcul des prix d'un panier. Utilisé par le devis ET par la création de commande,
// pour que le client paie exactement ce qu'on lui a annoncé.
@Injectable()
export class TarificationService {
  constructor(private readonly prisma: PrismaService) {}

  async chiffrer(demande: LigneDemandeDto[]): Promise<Chiffrage> {
    // 1. une variante demandée deux fois = une seule ligne (le palier joue sur le total)
    const quantites = new Map<number, number>();
    for (const ligne of demande) {
      quantites.set(
        ligne.idVariante,
        (quantites.get(ligne.idVariante) ?? 0) + ligne.quantite,
      );
    }

    // 2. on charge les variantes en UNE requête, avec leurs paliers et leur produit
    const variantes = await this.prisma.variante.findMany({
      where: { idVariante: { in: [...quantites.keys()] } },
      include: {
        produit: { select: { nomProduit: true, statutProduit: true } },
        paliers: { orderBy: { quantiteMinimum: 'desc' } }, // du plus grand au plus petit
      },
    });

    // 3. chaque variante doit exister, être en vente et appartenir à un produit publié
    const lignes: LigneChiffree[] = [];
    for (const [idVariante, quantite] of quantites) {
      const v = variantes.find((x) => x.idVariante === idVariante);
      if (!v || !v.estEnVente || v.produit.statutProduit !== 'publie') {
        throw new BadRequestException(
          `L'article ${idVariante} n'est pas disponible`,
        );
      }

      // 4. le palier : le premier (en partant du plus grand) que la quantité atteint
      const palier = v.paliers.find((p) => quantite >= p.quantiteMinimum);
      const prixUnitaireAed = palier
        ? palier.prixPalierAed
        : v.prixCatalogueAed;

      lignes.push({
        idVariante,
        produit: v.produit.nomProduit,
        variante: v.libelleVariante,
        quantite,
        prixUnitaireAed,
        poidsUnitaireKg: v.poidsEstimeKg,
        sousTotalAed: prixUnitaireAed.mul(quantite),
      });
    }

    // 5. les totaux
    const p = await this.parametres();
    const articlesAed = lignes.reduce(
      (total, l) => total.add(l.sousTotalAed),
      new D(0),
    );
    const articlesUsd = articlesAed.mul(p.taux).toDecimalPlaces(2);
    const poidsTotalKg = lignes.reduce(
      (total, l) => total.add(l.poidsUnitaireKg.mul(l.quantite)),
      new D(0),
    );

    return {
      tauxChangeAedUsd: p.taux,
      lignes,
      articlesAed,
      articlesUsd,
      poidsTotalKg,
      fraisTransportUsd: this.transport(articlesUsd, poidsTotalKg, p),
      fraisServiceUsd: this.fraisService(p),
    };
  }

  // ------- outils internes -------

  // Transport : un pourcentage du montant des articles, ou un prix au kilo
  private transport(
    articlesUsd: Decimal,
    poidsKg: Decimal,
    p: Parametres,
  ): Decimal {
    if (p.transportMode === 'pourcentage') {
      return articlesUsd
        .mul(p.transportPourcentage)
        .div(100)
        .toDecimalPlaces(2);
    }
    if (p.transportMode === 'poids') {
      if (!p.transportPrixKgUsd) {
        throw new InternalServerErrorException(
          'Paramètre transport_prix_kg_usd non renseigné',
        );
      }
      const poidsFacture = Prisma.Decimal.max(poidsKg, p.transportMinimumKg); // au moins 1 kg facturé
      return poidsFacture.mul(p.transportPrixKgUsd).toDecimalPlaces(2);
    }
    throw new InternalServerErrorException(
      `Mode de transport inconnu : ${p.transportMode}`,
    );
  }

  // Frais de service : un montant fixe par commande (seul mode décidé pour l'instant)
  private fraisService(p: Parametres): Decimal {
    if (p.fraisServiceMode !== 'fixe') {
      throw new InternalServerErrorException(
        `Mode de frais de service non géré : ${p.fraisServiceMode}`,
      );
    }
    return p.fraisServiceUsd;
  }

  // Lit tous les paramètres utiles en UNE requête
  private async parametres(): Promise<Parametres> {
    const lignes = await this.prisma.parametre.findMany({
      where: {
        codeParametre: {
          in: [
            'taux_change_aed_usd',
            'transport_mode',
            'transport_pourcentage',
            'transport_prix_kg_usd',
            'transport_minimum_kg',
            'frais_service_mode',
            'frais_service_usd',
          ],
        },
      },
    });
    // tableau → dictionnaire { code: valeur }
    const valeur = (code: string) =>
      lignes.find((l) => l.codeParametre === code)?.valeurParametre ?? '';
    const nombre = (code: string) => {
      const v = valeur(code);
      if (v === '') {
        throw new InternalServerErrorException(
          `Paramètre ${code} non renseigné`,
        );
      }
      return new D(v);
    };

    return {
      taux: nombre('taux_change_aed_usd'),
      transportMode: valeur('transport_mode'),
      transportPourcentage:
        valeur('transport_mode') === 'pourcentage'
          ? nombre('transport_pourcentage')
          : new D(0),
      transportPrixKgUsd: valeur('transport_prix_kg_usd')
        ? new D(valeur('transport_prix_kg_usd'))
        : null,
      transportMinimumKg: valeur('transport_minimum_kg')
        ? new D(valeur('transport_minimum_kg'))
        : new D(0),
      fraisServiceMode: valeur('frais_service_mode'),
      fraisServiceUsd: nombre('frais_service_usd'),
    };
  }
}

// Les paramètres de la direction, convertis en nombres exacts
interface Parametres {
  taux: Decimal;
  transportMode: string;
  transportPourcentage: Decimal;
  transportPrixKgUsd: Decimal | null;
  transportMinimumKg: Decimal;
  fraisServiceMode: string;
  fraisServiceUsd: Decimal;
}
