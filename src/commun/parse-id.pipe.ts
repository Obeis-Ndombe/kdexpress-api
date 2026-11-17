import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Optional,
  PipeTransform,
} from '@nestjs/common';

const ENTIER_MAX = 2_147_483_647; // le plus grand « Int » de PostgreSQL

// Lit un identifiant (ou un numéro de page) dans l'adresse : un entier de 1 à 2 147 483 647.
// Remplace ParseIntPipe, qui acceptait « 0x10 », « -1 » ou « 99999999999 » :
// ce dernier faisait planter la requête en base (erreur 500 au lieu d'une 400).
@Injectable()
export class ParseIdPipe implements PipeTransform<unknown, number | undefined> {
  constructor(@Optional() private readonly options?: { optional?: boolean }) {}

  transform(valeur: unknown, meta: ArgumentMetadata): number | undefined {
    if ((valeur === undefined || valeur === '') && this.options?.optional) {
      return undefined;
    }
    // un nombre si la validation globale l'a déjà converti (transform: true), sinon le texte reçu
    const n =
      typeof valeur === 'number'
        ? valeur
        : typeof valeur === 'string' && /^\d{1,10}$/.test(valeur)
          ? Number(valeur)
          : NaN;
    if (!(Number.isInteger(n) && n >= 1 && n <= ENTIER_MAX)) {
      throw new BadRequestException(
        `${meta.data ?? 'Le paramètre'} doit être un nombre entier positif`,
      );
    }
    return n;
  }
}
