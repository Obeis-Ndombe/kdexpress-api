import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Une ligne du panier : quelle variante, combien
export class LigneDemandeDto {
  @IsInt({ message: 'idVariante doit être un nombre entier' })
  @Min(1, { message: 'idVariante invalide' })
  idVariante: number;

  @IsInt({ message: 'La quantité doit être un nombre entier' })
  @Min(1, { message: 'La quantité minimum est 1' })
  @Max(100, { message: 'La quantité maximum est 100 par article' })
  quantite: number;
}

// Le panier envoyé par l'appli, pour un devis ou une commande
export class DemandeCommandeDto {
  @IsArray({ message: 'lignes doit être une liste' })
  @ArrayMinSize(1, { message: 'Le panier est vide' })
  @ArrayMaxSize(50, { message: '50 articles différents au plus par commande' })
  @ValidateNested({ each: true }) // vérifie aussi CHAQUE ligne avec les règles de LigneDemandeDto
  @Type(() => LigneDemandeDto) // transforme chaque objet reçu en LigneDemandeDto
  lignes: LigneDemandeDto[];
}
