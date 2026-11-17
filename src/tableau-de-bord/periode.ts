import { BadRequestException } from '@nestjs/common';

export const FUSEAU = 'Africa/Kinshasa'; // les journées du tableau de bord sont celles de Kinshasa
const JOURS_PAR_DEFAUT = 30;
const JOURS_MAX = 366;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

export interface Periode {
  du: string; // AAAA-MM-JJ, compris
  au: string; // AAAA-MM-JJ, compris
}

// Le jour qu'il est à Kinshasa, en AAAA-MM-JJ
export function aujourdhui(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(
    maintenant,
  );
}

function jourValide(jour: string): number {
  const ms = Date.parse(`${jour}T00:00:00Z`);
  // « 2026-02-31 » passe le format mais n'existe pas : JavaScript le décalerait en mars
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== jour) {
    throw new BadRequestException(`${jour} n'est pas une date du calendrier`);
  }
  return ms;
}

// Par défaut : les 30 derniers jours, aujourd'hui compris
export function periode(
  du: string | undefined,
  au: string | undefined,
  maintenant = new Date(),
): Periode {
  const fin = au ?? aujourdhui(maintenant);
  const finMs = jourValide(fin);
  const debut =
    du ??
    new Date(finMs - (JOURS_PAR_DEFAUT - 1) * UN_JOUR_MS)
      .toISOString()
      .slice(0, 10);
  const debutMs = jourValide(debut);
  if (debutMs > finMs) {
    throw new BadRequestException('du doit être avant au');
  }
  if ((finMs - debutMs) / UN_JOUR_MS + 1 > JOURS_MAX) {
    throw new BadRequestException(`La période fait ${JOURS_MAX} jours au plus`);
  }
  return { du: debut, au: fin };
}
