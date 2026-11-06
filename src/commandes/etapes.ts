// Les numéros d'ordre des étapes de commande (table etape_commande, remplie par la migration « contraintes »)
export const ORDRE_ETAPE = {
  EN_ATTENTE_PAIEMENT: 1,
  PAYEE: 2,
  ACHAT_EN_COURS: 3,
  ACHETEE: 4,
  EXPEDIEE: 5,
  ARRIVEE_KINSHASA: 6,
  PRETE_AU_RETRAIT: 7,
  RECUPEREE: 8,
  ANNULEE: 9,
} as const;
