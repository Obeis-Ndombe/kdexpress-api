import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ORDRE_ETAPE } from '../commandes/etapes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FUSEAU, Periode, periode } from './periode.js';

type D = Prisma.Decimal;
const usd = (v: D | null) => (v ?? new Prisma.Decimal(0)).toFixed(2);
const nombre = (v: bigint | number | null) => Number(v ?? 0);

// Le tableau de bord de la direction : les chiffres d'une période, et ce qui attend maintenant.
// Lecture seule. Chaque bloc est une requête d'agrégation ; elles partent ensemble.
@Injectable()
export class TableauDeBordService {
  constructor(private readonly prisma: PrismaService) {}

  async tableau(du?: string, au?: string) {
    const p = periode(du, au);
    const [
      commandes,
      encaissements,
      ventes,
      marge,
      avoirs,
      enCours,
      meilleuresVentes,
      parJour,
    ] = await Promise.all([
      this.commandes(p),
      this.encaissements(p),
      this.ventes(p),
      this.marge(p),
      this.avoirs(p),
      this.enCours(),
      this.meilleuresVentes(p),
      this.parJour(p),
    ]);
    return {
      periode: p,
      commandes,
      encaissements,
      ventes,
      marge,
      avoirs,
      enCours,
      meilleuresVentes,
      parJour,
    };
  }

  // ------- les chiffres de la période -------

  // « date BETWEEN » ne suffit pas : une journée de Kinshasa ne commence pas à minuit UTC
  private dans(colonne: Prisma.Sql, p: Periode): Prisma.Sql {
    return Prisma.sql`${colonne} >= (${p.du}::date::timestamp AT TIME ZONE ${FUSEAU})
      AND ${colonne} < ((${p.au}::date + 1)::timestamp AT TIME ZONE ${FUSEAU})`;
  }

  // Combien de commandes ont franchi chaque étape clé pendant la période
  private async commandes(p: Periode) {
    const lignes = await this.prisma.$queryRaw<
      { ordre_etape: number; nombre: bigint }[]
    >`
      SELECT e.ordre_etape, COUNT(*) AS nombre
      FROM historique_commande h
      JOIN etape_commande e USING (id_etape_commande)
      WHERE ${this.dans(Prisma.sql`h.date_franchissement`, p)}
      GROUP BY e.ordre_etape`;
    const a = (ordre: number) =>
      nombre(lignes.find((l) => l.ordre_etape === ordre)?.nombre ?? 0);
    return {
      creees: a(ORDRE_ETAPE.EN_ATTENTE_PAIEMENT),
      payees: a(ORDRE_ETAPE.PAYEE),
      expediees: a(ORDRE_ETAPE.EXPEDIEE),
      recuperees: a(ORDRE_ETAPE.RECUPEREE),
      annulees: a(ORDRE_ETAPE.ANNULEE),
    };
  }

  // L'argent reçu. Un paiement par avoir n'est pas de l'argent frais : il est compté à part.
  private async encaissements(p: Periode) {
    const lignes = await this.prisma.$queryRaw<
      { moyen: string; objet: string; total: D }[]
    >`
      SELECT moyen_paiement::text AS moyen, objet_paiement::text AS objet,
             SUM(montant_paye_usd) AS total
      FROM paiement
      WHERE ${this.dans(Prisma.sql`date_paiement`, p)}
      GROUP BY moyen_paiement, objet_paiement`;
    const somme = (garder: (l: { moyen: string; objet: string }) => boolean) =>
      usd(
        lignes
          .filter(garder)
          .reduce((t, l) => t.add(l.total), new Prisma.Decimal(0)),
      );
    return {
      argentRecuUsd: somme((l) => l.moyen !== 'avoir'),
      payeParAvoirUsd: somme((l) => l.moyen === 'avoir'),
      parMoyen: {
        especes: somme((l) => l.moyen === 'especes'),
        mobile_money: somme((l) => l.moyen === 'mobile_money'),
        carte: somme((l) => l.moyen === 'carte'),
      },
      parObjet: {
        articles_transport: somme((l) => l.objet === 'articles_transport'),
        solde_retrait: somme((l) => l.objet === 'solde_retrait'),
        frais_stockage: somme((l) => l.objet === 'frais_stockage'),
      },
    };
  }

  // Ce que valent les commandes passées dans la période (hors commandes annulées)
  private async ventes(p: Periode) {
    const [v] = await this.prisma.$queryRaw<
      {
        commandes: bigint;
        articles_aed: D | null;
        articles_usd: D | null;
        transport_usd: D | null;
        service_usd: D | null;
      }[]
    >`
      SELECT COUNT(*) AS commandes,
             SUM(a.articles_aed) AS articles_aed,
             SUM(ROUND(a.articles_aed * c.taux_change_aed_usd, 2)) AS articles_usd,
             SUM(c.frais_transport_usd) AS transport_usd,
             SUM(c.frais_service_usd) AS service_usd
      FROM commande c
      JOIN LATERAL (
        SELECT COALESCE(SUM(l.prix_unitaire_aed * l.quantite), 0) AS articles_aed
        FROM ligne_commande l WHERE l.id_commande = c.id_commande
      ) a ON true
      WHERE ${this.dans(Prisma.sql`c.date_commande`, p)}
        AND NOT EXISTS (
          SELECT 1 FROM historique_commande h
          JOIN etape_commande e USING (id_etape_commande)
          WHERE h.id_commande = c.id_commande AND e.ordre_etape = ${ORDRE_ETAPE.ANNULEE})`;
    return {
      commandes: nombre(v.commandes),
      articlesAed: usd(v.articles_aed),
      articlesUsd: usd(v.articles_usd),
      transportUsd: usd(v.transport_usd),
      serviceUsd: usd(v.service_usd),
    };
  }

  // La marge réelle sur les articles achetés à Dubaï dans la période :
  // prix payé par le client (figé à la commande) − prix réellement payé à la boutique
  private async marge(p: Periode) {
    const [m] = await this.prisma.$queryRaw<
      {
        articles: bigint | null;
        vendu_aed: D | null;
        achete_aed: D | null;
        marge_usd: D | null;
      }[]
    >`
      SELECT SUM(l.quantite) AS articles,
             SUM(l.prix_unitaire_aed * l.quantite) AS vendu_aed,
             SUM(l.prix_achat_reel_aed * l.quantite) AS achete_aed,
             SUM(ROUND((l.prix_unitaire_aed - l.prix_achat_reel_aed) * l.quantite
                       * c.taux_change_aed_usd, 2)) AS marge_usd
      FROM ligne_commande l
      JOIN achat_boutique a USING (id_achat_boutique)
      JOIN commande c USING (id_commande)
      WHERE l.statut_ligne_commande = 'achetee'
        AND l.prix_achat_reel_aed IS NOT NULL
        AND ${this.dans(Prisma.sql`a.date_achat`, p)}`;
    const vendu = m.vendu_aed ?? new Prisma.Decimal(0);
    const achete = m.achete_aed ?? new Prisma.Decimal(0);
    return {
      articlesAchetes: nombre(m.articles),
      venduAed: usd(vendu),
      acheteAed: usd(achete),
      margeAed: usd(vendu.minus(achete)),
      margeUsd: usd(m.marge_usd),
      // en % du prix d'achat, comme la marge du catalogue
      margePourcentage: achete.gt(0)
        ? vendu.minus(achete).div(achete).times(100).toFixed(1)
        : null,
    };
  }

  // Les avoirs : ce que KDExpress doit aux clients
  private async avoirs(p: Periode) {
    const [a] = await this.prisma.$queryRaw<
      { credites: D | null; utilises: D | null }[]
    >`
      SELECT SUM(montant_usd) FILTER (WHERE montant_usd > 0) AS credites,
             -SUM(montant_usd) FILTER (WHERE montant_usd < 0) AS utilises
      FROM operation_avoir
      WHERE ${this.dans(Prisma.sql`date_operation`, p)}`;
    const [solde] = await this.prisma.$queryRaw<{ total: D | null }[]>`
      SELECT SUM(montant_usd) AS total FROM operation_avoir`;
    return {
      creditesUsd: usd(a.credites),
      utilisesUsd: usd(a.utilises),
      totalDuAuxClientsUsd: usd(solde.total), // aujourd'hui, toutes périodes confondues
    };
  }

  private async meilleuresVentes(p: Periode) {
    const lignes = await this.prisma.$queryRaw<
      {
        id_produit: number;
        nom_produit: string;
        quantite: bigint;
        montant_aed: D;
      }[]
    >`
      SELECT pr.id_produit, pr.nom_produit,
             SUM(l.quantite) AS quantite,
             SUM(l.prix_unitaire_aed * l.quantite) AS montant_aed
      FROM ligne_commande l
      JOIN commande c USING (id_commande)
      JOIN variante v USING (id_variante)
      JOIN produit pr USING (id_produit)
      WHERE ${this.dans(Prisma.sql`c.date_commande`, p)}
        AND l.statut_ligne_commande NOT IN ('introuvable', 'remboursee')
        AND NOT EXISTS (
          SELECT 1 FROM historique_commande h
          JOIN etape_commande e USING (id_etape_commande)
          WHERE h.id_commande = c.id_commande AND e.ordre_etape = ${ORDRE_ETAPE.ANNULEE})
      GROUP BY pr.id_produit, pr.nom_produit
      ORDER BY SUM(l.quantite) DESC, pr.id_produit
      LIMIT 5`;
    return lignes.map((l) => ({
      idProduit: l.id_produit,
      produit: l.nom_produit,
      quantite: nombre(l.quantite),
      montantAed: usd(l.montant_aed),
    }));
  }

  // Une ligne par jour de la période, même les jours sans activité (pour tracer une courbe)
  private async parJour(p: Periode) {
    const lignes = await this.prisma.$queryRaw<
      { jour: string; commandes: bigint; argent_recu: D }[]
    >`
      SELECT to_char(j.jour, 'YYYY-MM-DD') AS jour,
             (SELECT COUNT(*) FROM commande c
               WHERE (c.date_commande AT TIME ZONE ${FUSEAU})::date = j.jour) AS commandes,
             (SELECT COALESCE(SUM(pa.montant_paye_usd), 0) FROM paiement pa
               WHERE (pa.date_paiement AT TIME ZONE ${FUSEAU})::date = j.jour
                 AND pa.moyen_paiement <> 'avoir') AS argent_recu
      FROM (SELECT generate_series(${p.du}::date, ${p.au}::date, interval '1 day')::date AS jour) j
      ORDER BY j.jour`;
    return lignes.map((l) => ({
      jour: l.jour,
      commandes: nombre(l.commandes),
      argentRecuUsd: usd(l.argent_recu),
    }));
  }

  // ------- ce qui attend, maintenant -------

  private async enCours() {
    const parEtape = await this.prisma.$queryRaw<
      { libelle_etape: string; ordre_etape: number; nombre: bigint }[]
    >`
      SELECT e.libelle_etape, e.ordre_etape, COUNT(a.id_commande) AS nombre
      FROM etape_commande e
      LEFT JOIN (
        SELECT DISTINCT ON (h.id_commande) h.id_commande, e2.ordre_etape
        FROM historique_commande h
        JOIN etape_commande e2 USING (id_etape_commande)
        ORDER BY h.id_commande, e2.ordre_etape DESC
      ) a ON a.ordre_etape = e.ordre_etape
      GROUP BY e.libelle_etape, e.ordre_etape
      ORDER BY e.ordre_etape`;

    const [f] = await this.prisma.$queryRaw<
      {
        lignes_a_acheter: bigint;
        colis_a_expedier: bigint;
        colis_en_route: bigint;
        retraits_en_retard: bigint;
        produits_proposes: bigint;
        boutiques_en_attente: bigint;
      }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM ligne_commande l
          WHERE l.statut_ligne_commande = 'a_acheter'
            AND EXISTS (SELECT 1 FROM historique_commande h JOIN etape_commande e USING (id_etape_commande)
                        WHERE h.id_commande = l.id_commande AND e.ordre_etape = ${ORDRE_ETAPE.PAYEE})
            AND NOT EXISTS (SELECT 1 FROM historique_commande h JOIN etape_commande e USING (id_etape_commande)
                        WHERE h.id_commande = l.id_commande AND e.ordre_etape = ${ORDRE_ETAPE.ANNULEE})
        ) AS lignes_a_acheter,
        (SELECT COUNT(*) FROM colis WHERE statut_colis = 'prepare') AS colis_a_expedier,
        (SELECT COUNT(*) FROM colis WHERE statut_colis = 'expedie') AS colis_en_route,
        (SELECT COUNT(*) FROM (
            SELECT DISTINCT ON (h.id_commande) h.id_commande, e.ordre_etape, h.date_franchissement
            FROM historique_commande h JOIN etape_commande e USING (id_etape_commande)
            ORDER BY h.id_commande, e.ordre_etape DESC) a
          WHERE a.ordre_etape = ${ORDRE_ETAPE.PRETE_AU_RETRAIT}
            AND a.date_franchissement < now() - make_interval(days =>
              COALESCE((SELECT NULLIF(valeur_parametre, '')::int FROM parametre
                        WHERE code_parametre = 'delai_retrait_jours'), 30))
        ) AS retraits_en_retard,
        (SELECT COUNT(*) FROM produit WHERE statut_produit = 'propose') AS produits_proposes,
        (SELECT COUNT(*) FROM boutique WHERE statut_boutique = 'en_attente') AS boutiques_en_attente`;

    return {
      commandesParEtape: parEtape.map((e) => ({
        etape: e.libelle_etape,
        nombre: nombre(e.nombre),
      })),
      articlesAAcheter: nombre(f.lignes_a_acheter),
      colisAExpedier: nombre(f.colis_a_expedier),
      colisEnRoute: nombre(f.colis_en_route),
      retraitsEnRetard: nombre(f.retraits_en_retard), // prêtes depuis plus de delai_retrait_jours
      produitsAValider: nombre(f.produits_proposes),
      boutiquesAVerifier: nombre(f.boutiques_en_attente),
    };
  }
}
