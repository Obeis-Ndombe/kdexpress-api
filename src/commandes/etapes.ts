// Les numéros d'ordre des étapes de commande (table etape_commande, remplie par la migration « contraintes »)
export const ORDRE_ETAPE = {
  EN_ATTENTE_PAIEMENT: 1,
  PAYEE: 2,
  ANNULEE: 9,
} as const;
