import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const PROFONDEUR_MAX = 32; // nos DTO les plus imbriqués en ont 4

// Refuse un corps de requête imbriqué sur des milliers de niveaux ([[[[…]]]]) :
// la validation le parcourt récursivement et faisait déborder la pile (erreur 500).
// Le parcours se fait ici sans récursion, avec une pile explicite.
@Injectable()
export class ProfondeurPipe implements PipeTransform {
  transform(valeur: unknown) {
    const aVisiter: [unknown, number][] = [[valeur, 1]];
    while (aVisiter.length > 0) {
      const [element, profondeur] = aVisiter.pop()!;
      if (element === null || typeof element !== 'object') continue;
      if (profondeur > PROFONDEUR_MAX) {
        throw new BadRequestException('Corps de requête trop imbriqué');
      }
      for (const enfant of Object.values(element)) {
        aVisiter.push([enfant, profondeur + 1]);
      }
    }
    return valeur;
  }
}
