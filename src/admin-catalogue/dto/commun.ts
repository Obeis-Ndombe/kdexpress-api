// Outils partagés par les DTO du catalogue

// enlève les espaces autour d'un texte AVANT de le vérifier
export const nettoyer = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// un prix en dirhams, envoyé en texte : "180.00" (2 décimales au plus)
export const PRIX_REGEX = /^\d{1,10}(\.\d{1,2})?$/;
export const PRIX_MESSAGE = 'Prix invalide : un nombre comme "180.00"';

// un poids en kg, envoyé en texte : "0.450" (3 décimales au plus)
export const POIDS_REGEX = /^\d{1,5}(\.\d{1,3})?$/;
export const POIDS_MESSAGE = 'Poids invalide : un nombre comme "0.450"';
