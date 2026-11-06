import { ObjetPaiement, Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;

// Ce qu'il faut d'une commande enregistrée pour calculer ce qu'elle doit
export interface CommandeAChiffrer {
  tauxChangeAedUsd: Decimal;
  fraisTransportUsd: Decimal;
  fraisServiceUsd: Decimal;
  lignes: { prixUnitaireAed: Decimal; quantite: number }[];
}

// Montant des articles en USD : total en AED, converti UNE seule fois puis arrondi
export function articlesEnUsd(c: CommandeAChiffrer): Decimal {
  const articlesAed = c.lignes.reduce(
    (total, l) => total.add(l.prixUnitaireAed.mul(l.quantite)),
    new Prisma.Decimal(0),
  );
  return articlesAed.mul(c.tauxChangeAedUsd).toDecimalPlaces(2);
}

// Ce que la commande doit, pour chaque objet de paiement
export function montantsDus(
  c: CommandeAChiffrer,
): Record<ObjetPaiement, Decimal> {
  return {
    articles_transport: articlesEnUsd(c).add(c.fraisTransportUsd), // payé à la commande
    solde_retrait: c.fraisServiceUsd, // payé au retrait
    frais_stockage: new Prisma.Decimal(0), // pas encore décidé par la direction
  };
}

// Ce qu'il reste à payer, compte tenu des paiements déjà reçus
export function resteAPayer(
  c: CommandeAChiffrer,
  paiements: { objetPaiement: ObjetPaiement; montantPayeUsd: Decimal }[],
) {
  const dus = montantsDus(c);
  const reste = (objet: ObjetPaiement) => {
    const paye = paiements
      .filter((p) => p.objetPaiement === objet)
      .reduce((total, p) => total.add(p.montantPayeUsd), new Prisma.Decimal(0));
    return Prisma.Decimal.max(dus[objet].sub(paye), 0);
  };
  const articlesTransport = reste('articles_transport');
  const soldeRetrait = reste('solde_retrait');
  return {
    articlesTransport,
    soldeRetrait,
    total: articlesTransport.add(soldeRetrait),
  };
}

// Ce qu'on rend au client pour une ligne qui n'a pas pu être achetée :
// l'article au taux figé, plus sa part du transport payé (au prorata du montant des articles)
export function remboursementLigne(
  c: CommandeAChiffrer,
  ligne: { prixUnitaireAed: Decimal; quantite: number },
) {
  const articleUsd = ligne.prixUnitaireAed
    .mul(ligne.quantite)
    .mul(c.tauxChangeAedUsd)
    .toDecimalPlaces(2);
  const totalArticlesUsd = articlesEnUsd(c);
  const transportUsd = totalArticlesUsd.isZero()
    ? new Prisma.Decimal(0)
    : c.fraisTransportUsd
        .mul(articleUsd)
        .div(totalArticlesUsd)
        .toDecimalPlaces(2);
  return { articleUsd, transportUsd, totalUsd: articleUsd.add(transportUsd) };
}
