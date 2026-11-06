import { randomInt, randomUUID } from 'node:crypto';

// Alphabet sans les caractères qui se confondent à la lecture : pas de 0/O, ni de 1/I/L
const ALPHABET_RETRAIT = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

// Le code que le client présente au bureau de Kinshasa, ex. « 7KQ4XM »
export function genererCodeRetrait(longueur = 6): string {
  let code = '';
  for (let i = 0; i < longueur; i++) {
    code += ALPHABET_RETRAIT[randomInt(ALPHABET_RETRAIT.length)]; // vrai hasard, imprévisible
  }
  return code;
}

// Le numéro lisible de la commande, ex. « KD-2026-000042 »
export function numeroCommande(annee: number, idCommande: number): string {
  return `KD-${annee}-${String(idCommande).padStart(6, '0')}`;
}

// Numéro provisoire, unique, remplacé dans la même transaction dès que l'id est connu
export function numeroProvisoire(): string {
  return `TMP-${randomUUID().slice(0, 16)}`; // 20 caractères, la taille de la colonne
}
