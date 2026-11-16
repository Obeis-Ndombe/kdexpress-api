import { Prisma } from '@prisma/client';

// Les réglages de KDExpress (table « parametre ») et ce que chacun accepte.
// Une valeur fausse ici fausserait tous les devis : chaque réglage a donc sa règle.

interface Regle {
  aide: string; // affichée à la direction
  // renvoie la valeur à enregistrer (nettoyée), ou lève une erreur avec le motif
  verifier: (valeur: string) => string;
}

class ValeurRefusee extends Error {}

function nombre(
  valeur: string,
  o: { min: number; max: number; decimales: number; strict?: boolean },
): string {
  const motif =
    o.decimales === 0
      ? /^\d{1,9}$/
      : new RegExp(`^\\d{1,9}(\\.\\d{1,${o.decimales}})?$`);
  if (!motif.test(valeur)) {
    throw new ValeurRefusee(
      o.decimales === 0
        ? 'un nombre entier est attendu'
        : `un nombre avec ${o.decimales} décimales au plus est attendu (ex. 12.5)`,
    );
  }
  const n = new Prisma.Decimal(valeur);
  if (n.lt(o.min) || n.gt(o.max) || (o.strict && n.lte(o.min))) {
    throw new ValeurRefusee(
      `la valeur doit être ${o.strict ? 'supérieure à' : 'au moins'} ${o.min} et au plus ${o.max}`,
    );
  }
  return n.toString();
}

function choix(valeur: string, permis: string[]): string {
  if (!permis.includes(valeur)) {
    throw new ValeurRefusee(`valeurs possibles : ${permis.join(', ')}`);
  }
  return valeur;
}

// une valeur vide signifie « pas encore décidé »
const facultatif =
  (verifier: (v: string) => string) =>
  (valeur: string): string =>
    valeur === '' ? '' : verifier(valeur);

export const REGLES: Record<string, Regle> = {
  taux_change_aed_usd: {
    aide: 'Valeur d’un dirham en dollars, entre 0.05 et 2 (ex. 0.272294)',
    verifier: (v) => nombre(v, { min: 0.05, max: 2, decimales: 6 }),
  },
  transport_mode: {
    aide: 'pourcentage (du montant des articles) ou poids (prix au kilo)',
    verifier: (v) => choix(v, ['pourcentage', 'poids']),
  },
  transport_pourcentage: {
    aide: 'Pourcentage du montant des articles, de 0 à 100',
    verifier: (v) => nombre(v, { min: 0, max: 100, decimales: 2 }),
  },
  transport_prix_kg_usd: {
    aide: 'Prix du kilo en dollars (obligatoire si le transport est au poids)',
    verifier: facultatif((v) =>
      nombre(v, { min: 0, max: 1000, decimales: 2, strict: true }),
    ),
  },
  transport_minimum_kg: {
    aide: 'Poids minimum facturé par commande, en kg, de 0 à 100',
    verifier: (v) => nombre(v, { min: 0, max: 100, decimales: 3 }),
  },
  frais_service_mode: {
    aide: 'fixe (seul mode disponible)',
    verifier: (v) => choix(v, ['fixe']),
  },
  frais_service_usd: {
    aide: 'Frais de service par commande, en dollars, de 0 à 1000',
    verifier: (v) => nombre(v, { min: 0, max: 1000, decimales: 2 }),
  },
  marge_catalogue_pourcentage: {
    aide: 'Marge ajoutée au prix boutique pour proposer le prix client, de 0 à 500 %',
    verifier: (v) => nombre(v, { min: 0, max: 500, decimales: 2 }),
  },
  delai_alerte_achat_jours: {
    aide: 'Jours avant l’alerte pour un achat en attente, de 1 à 365',
    verifier: (v) => nombre(v, { min: 1, max: 365, decimales: 0 }),
  },
  delai_retrait_jours: {
    aide: 'Jours pour retirer un colis avant frais de stockage, de 1 à 365',
    verifier: (v) => nombre(v, { min: 1, max: 365, decimales: 0 }),
  },
  frais_stockage_usd: {
    aide: 'Frais de stockage en dollars (vide tant que ce n’est pas décidé)',
    verifier: facultatif((v) => nombre(v, { min: 0, max: 1000, decimales: 2 })),
  },
};

// Vérifie une valeur ; renvoie { valeur } nettoyée ou { erreur } à montrer à la direction
export function verifierParametre(
  code: string,
  valeur: string,
): { valeur: string } | { erreur: string } {
  const regle = REGLES[code];
  if (!regle) {
    return { erreur: `Réglage inconnu : ${code}` };
  }
  try {
    return { valeur: regle.verifier(valeur.trim()) };
  } catch (erreur) {
    if (erreur instanceof ValeurRefusee) {
      return { erreur: `${code} : ${erreur.message}` };
    }
    throw erreur;
  }
}

// Les réglages doivent rester cohérents ENTRE EUX, sinon plus aucun devis ne se calcule
export function incoherence(valeurs: Map<string, string>): string | null {
  if (
    valeurs.get('transport_mode') === 'poids' &&
    !valeurs.get('transport_prix_kg_usd')
  ) {
    return 'Le transport au poids demande un prix du kilo (transport_prix_kg_usd)';
  }
  for (const code of [
    'taux_change_aed_usd',
    'transport_pourcentage',
    'frais_service_usd',
  ]) {
    if (!valeurs.get(code)) {
      return `${code} ne peut pas être vide`;
    }
  }
  return null;
}
