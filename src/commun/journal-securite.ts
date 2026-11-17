import { Logger } from '@nestjs/common';

// Le journal des événements de sécurité (connexions ratées, blocages, accès refusés).
// Il permet de repérer une attaque en cours. On n'y écrit jamais de mot de passe ni de code.
export const journalSecurite = new Logger('Sécurité');

// « marie.kabila@exemple.cd » -> « ma***@exemple.cd » : assez pour enquêter, sans tout exposer
export function emailMasque(email: string): string {
  const [nom, domaine] = email.split('@');
  return domaine ? `${nom.slice(0, 2)}***@${domaine}` : '***';
}
