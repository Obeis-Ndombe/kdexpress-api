import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  genererCodeRetrait,
  numeroCommande,
  numeroProvisoire,
} from './codes.js';
import { DemandeCommandeDto } from './dto/demande-commande.dto.js';
import { Chiffrage, TarificationService } from './tarification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Decimal = Prisma.Decimal;

// Nombre d'essais si le code de retrait tiré existe déjà (très rare)
const ESSAIS_CODE_RETRAIT = 5;

@Injectable()
export class CommandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tarification: TarificationService,
  ) {}

  // POST /commandes/devis : ce que coûterait ce panier, sans rien enregistrer
  async devis(dto: DemandeCommandeDto) {
    const chiffrage = await this.tarification.chiffrer(dto.lignes);
    return this.presenter(chiffrage);
  }

  // POST /commandes : le panier devient une vraie commande, aux prix figés
  async creer(dto: DemandeCommandeDto, idClient: number) {
    // 1. le même calcul que le devis : le client paie ce qu'on lui a annoncé
    const chiffrage = await this.tarification.chiffrer(dto.lignes);

    // la 1re étape du suivi : « En attente de paiement »
    const premiereEtape = await this.prisma.etapeCommande.findFirst({
      where: { ordreEtape: 1 },
    });
    if (!premiereEtape) {
      throw new InternalServerErrorException(
        'Étape de commande n°1 absente de la table etape_commande',
      );
    }

    // si le code de retrait tiré existe déjà, la base refuse (P2002) et on recommence
    for (let essai = 1; essai <= ESSAIS_CODE_RETRAIT; essai++) {
      try {
        const commande = await this.enregistrer(
          chiffrage,
          idClient,
          premiereEtape.idEtapeCommande,
        );
        return {
          idCommande: commande.idCommande,
          numeroCommande: commande.numeroCommande,
          codeRetrait: commande.codeRetrait,
          dateCommande: commande.dateCommande,
          etape: premiereEtape.libelleEtape,
          ...this.presenter(chiffrage),
        };
      } catch (erreur) {
        const doublon =
          erreur instanceof Prisma.PrismaClientKnownRequestError &&
          erreur.code === 'P2002';
        if (!doublon || essai === ESSAIS_CODE_RETRAIT) {
          throw erreur;
        }
      }
    }
    throw new InternalServerErrorException(
      'Création de la commande impossible',
    );
  }

  // ------- outils internes -------

  // Toutes les écritures d'une commande, dans UNE transaction : tout ou rien
  private enregistrer(c: Chiffrage, idClient: number, idPremiereEtape: number) {
    return this.prisma.$transaction(async (tx) => {
      // 2. la commande, avec le taux et les frais de ce jour-là
      const brouillon = await tx.commande.create({
        data: {
          numeroCommande: numeroProvisoire(),
          codeRetrait: genererCodeRetrait(),
          tauxChangeAedUsd: c.tauxChangeAedUsd,
          fraisTransportUsd: c.fraisTransportUsd,
          fraisServiceUsd: c.fraisServiceUsd,
          idClient,
        },
      });

      // 3. le vrai numéro, maintenant que l'id est connu
      const commande = await tx.commande.update({
        where: { idCommande: brouillon.idCommande },
        data: {
          numeroCommande: numeroCommande(
            brouillon.dateCommande.getFullYear(),
            brouillon.idCommande,
          ),
        },
      });

      // 5. les lignes, prix et poids figés (la « photo » du jour)
      await tx.ligneCommande.createMany({
        data: c.lignes.map((l) => ({
          idCommande: commande.idCommande,
          idVariante: l.idVariante,
          quantite: l.quantite,
          prixUnitaireAed: l.prixUnitaireAed,
          poidsUnitaireKg: l.poidsUnitaireKg,
        })),
      });

      // 6. la première étape du suivi
      await tx.historiqueCommande.create({
        data: {
          idCommande: commande.idCommande,
          idEtapeCommande: idPremiereEtape,
        },
      });

      return commande;
    });
  }

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
