import { Transform, Type } from 'class-transformer';
import { UsageCaracteristique } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { nettoyer, POIDS_MESSAGE, POIDS_REGEX } from './commun.js';

// POST /admin/categories
export class CreerCategorieDto {
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom: string;

  // poids utilisé quand une variante n'a pas de poids estimé
  @Matches(POIDS_REGEX, { message: POIDS_MESSAGE })
  poidsParDefautKg: string;
}

// PATCH /admin/categories/:id : on n'envoie que ce qui change
export class ModifierCategorieDto {
  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom?: string;

  @IsOptional()
  @Matches(POIDS_REGEX, { message: POIDS_MESSAGE })
  poidsParDefautKg?: string;
}

export class CaracteristiqueDeCategorieDto {
  @IsInt({ message: 'idCaracteristique doit être un entier' })
  @Min(1)
  idCaracteristique: number;

  // description : décrit le produit (Concentration : Eau de parfum)
  // choix_variante : distingue les variantes (Contenance : 50 ml / 100 ml)
  @IsEnum(UsageCaracteristique, {
    message: 'usage doit être « description » ou « choix_variante »',
  })
  usage: UsageCaracteristique;
}

// PUT /admin/categories/:id/caracteristiques : la liste complète remplace l'ancienne
export class DefinirCaracteristiquesCategorieDto {
  @IsArray({ message: 'caracteristiques doit être une liste' })
  @ArrayMaxSize(30, { message: '30 caractéristiques au plus' })
  @ValidateNested({ each: true })
  @Type(() => CaracteristiqueDeCategorieDto)
  caracteristiques: CaracteristiqueDeCategorieDto[];
}
