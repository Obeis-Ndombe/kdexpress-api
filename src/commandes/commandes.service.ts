import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DemandeCommandeDto } from './dto/demande-commande.dto.js';
import { Chiffrage, TarificationService } from './tarification.service.js';

type Decimal = Prisma.Decimal;

@Injectable()
export class CommandesService {
  constructor(private readonly tarification: TarificationService) {}

  // POST /commandes/devis : ce que coûterait ce panier, sans rien enregistrer
  async devis(dto: DemandeCommandeDto) {
    const chiffrage = await this.tarification.chiffrer(dto.lignes);
    return this.presenter(chiffrage);
  }

  // ------- outils internes -------

  // Met le chiffrage en forme pour le client : textes à 2 décimales, AED et USD
  private presenter(c: Chiffrage) {
    const usd = (aed: Decimal) => aed.mul(c.tauxChangeAedUsd).toFixed(2);
    const aPayerMaintenant = c.articlesUsd.add(c.fraisTransportUsd);

    return {
      tauxChangeAedUsd: c.tauxChangeAedUsd.toString(),
      lignes: c.lignes.map((l) => ({
        idVariante: l.idVariante,
        produit: l.produit,
        variante: l.variante,
        quantite: l.quantite,
        prixUnitaire: {
          aed: l.prixUnitaireAed.toFixed(2),
          usd: usd(l.prixUnitaireAed),
        },
        sousTotal: { aed: l.sousTotalAed.toFixed(2), usd: usd(l.sousTotalAed) },
      })),
      poidsEstimeKg: c.poidsTotalKg.toFixed(3),
      articles: {
        aed: c.articlesAed.toFixed(2),
        usd: c.articlesUsd.toFixed(2),
      },
      fraisTransportUsd: c.fraisTransportUsd.toFixed(2),
      fraisServiceUsd: c.fraisServiceUsd.toFixed(2),
      aPayerALaCommandeUsd: aPayerMaintenant.toFixed(2), // articles + transport
      aPayerAuRetraitUsd: c.fraisServiceUsd.toFixed(2), // frais de service
      totalUsd: aPayerMaintenant.add(c.fraisServiceUsd).toFixed(2),
    };
  }
}
