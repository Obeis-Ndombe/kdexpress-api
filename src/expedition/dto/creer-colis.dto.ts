import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const POIDS = /^\d{1,5}(\.\d{1,3})?$/; // en kg, 3 décimales au plus : "1.250"

// Une ligne de commande mise (en tout ou en partie) dans le colis
export class ContenuColisDto {
  @IsInt({ message: 'idLigneCommande doit être un nombre entier' })
  @Min(1, { message: 'idLigneCommande invalide' })
  idLigneCommande: number;

  @IsInt({ message: 'La quantité doit être un nombre entier' })
  @Min(1, { message: 'La quantité minimum est 1' })
  @Max(100, { message: 'La quantité maximum est 100' })
  quantite: number;
}

// POST /colis
export class CreerColisDto {
  @IsInt({ message: 'idCommande doit être un nombre entier' })
  @Min(1, { message: 'idCommande invalide' })
  idCommande: number;

  @IsOptional()
  @IsString({ message: 'poidsReelKg doit être un texte, ex. "1.250"' })
  @Matches(POIDS, { message: 'poidsReelKg : un poids en kg, ex. "1.250"' })
  poidsReelKg?: string;

  @IsArray({ message: 'contenu doit être une liste' })
  @ArrayMinSize(1, { message: 'Le colis est vide' })
  @ArrayMaxSize(50, { message: '50 lignes au plus par colis' })
  @ValidateNested({ each: true })
  @Type(() => ContenuColisDto)
  contenu: ContenuColisDto[];
}

// PATCH /colis/:id : le poids pesé plus tard
export class PeserColisDto {
  @IsString({ message: 'poidsReelKg doit être un texte, ex. "1.250"' })
  @Matches(POIDS, { message: 'poidsReelKg : un poids en kg, ex. "1.250"' })
  poidsReelKg: string;
}
