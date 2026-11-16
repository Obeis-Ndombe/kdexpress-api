import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  nettoyer,
  POIDS_MESSAGE,
  POIDS_REGEX,
  PRIX_MESSAGE,
  PRIX_REGEX,
} from './commun.js';

// Une caractéristique avec sa valeur : { idCaracteristique: 2, valeur: "Eau de parfum" }
export class ValeurCaracteristiqueDto {
  @IsInt({ message: 'idCaracteristique doit être un entier' })
  @Min(1)
  idCaracteristique: number;

  @Transform(nettoyer)
  @IsString({ message: 'La valeur doit être un texte' })
  @IsNotEmpty({ message: 'La valeur est obligatoire' })
  @MaxLength(120, { message: 'La valeur fait 120 caractères au plus' })
  valeur: string;
}

// « dès 6 pièces : 260.00 AED l'unité »
export class PalierDto {
  @IsInt({ message: 'aPartirDe doit être un entier' })
  @Min(2, { message: 'Un palier commence à 2 pièces au moins' })
  aPartirDe: number;

  @Matches(PRIX_REGEX, { message: PRIX_MESSAGE })
  prixAed: string;
}

export class VarianteDto {
  // sans libellé : « Standard »
  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'Le libellé doit être un texte' })
  @IsNotEmpty({ message: 'Le libellé ne peut pas être vide' })
  @MaxLength(120, { message: 'Le libellé fait 120 caractères au plus' })
  libelle?: string;

  @Matches(PRIX_REGEX, { message: PRIX_MESSAGE })
  prixCatalogueAed: string;

  // sans poids : celui de la catégorie
  @IsOptional()
  @Matches(POIDS_REGEX, { message: POIDS_MESSAGE })
  poidsEstimeKg?: string;

  // les choix qui distinguent cette variante (Contenance : 50)
  @IsOptional()
  @IsArray({ message: 'options doit être une liste' })
  @ArrayMaxSize(10, { message: '10 options au plus' })
  @ValidateNested({ each: true })
  @Type(() => ValeurCaracteristiqueDto)
  options?: ValeurCaracteristiqueDto[];

  @IsOptional()
  @IsArray({ message: 'paliers doit être une liste' })
  @ArrayMaxSize(10, { message: '10 paliers au plus' })
  @ValidateNested({ each: true })
  @Type(() => PalierDto)
  paliers?: PalierDto[];
}

// POST /admin/produits : le produit complet en une requête
export class CreerProduitDto {
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire' })
  @MaxLength(150, { message: 'Le nom fait 150 caractères au plus' })
  nom: string;

  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'La description doit être un texte' })
  @MaxLength(5000, { message: 'La description fait 5000 caractères au plus' })
  description?: string;

  @IsInt({ message: 'idCategorie doit être un entier' })
  @Min(1)
  idCategorie: number;

  @IsOptional()
  @IsInt({ message: 'idMarque doit être un entier' })
  @Min(1)
  idMarque?: number;

  // true : visible tout de suite au catalogue ; sinon le produit reste « propose »
  @IsOptional()
  @IsBoolean({ message: 'publier doit être true ou false' })
  publier?: boolean;

  @IsOptional()
  @IsArray({ message: 'caracteristiques doit être une liste' })
  @ArrayMaxSize(30, { message: '30 caractéristiques au plus' })
  @ValidateNested({ each: true })
  @Type(() => ValeurCaracteristiqueDto)
  caracteristiques?: ValeurCaracteristiqueDto[];

  @IsArray({ message: 'variantes doit être une liste' })
  @ArrayMinSize(1, { message: 'Un produit a au moins une variante' })
  @ArrayMaxSize(30, { message: '30 variantes au plus' })
  @ValidateNested({ each: true })
  @Type(() => VarianteDto)
  variantes: VarianteDto[];
}

// PATCH /admin/produits/:id : ce qui change (idMarque: null retire la marque)
export class ModifierProduitDto {
  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide' })
  @MaxLength(150, { message: 'Le nom fait 150 caractères au plus' })
  nom?: string;

  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'La description doit être un texte' })
  @MaxLength(5000, { message: 'La description fait 5000 caractères au plus' })
  description?: string;

  @IsOptional()
  @IsInt({ message: 'idMarque doit être un entier' })
  @Min(1)
  idMarque?: number | null;
}

// PATCH /admin/variantes/:id
export class ModifierVarianteDto {
  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'Le libellé doit être un texte' })
  @IsNotEmpty({ message: 'Le libellé ne peut pas être vide' })
  @MaxLength(120, { message: 'Le libellé fait 120 caractères au plus' })
  libelle?: string;

  @IsOptional()
  @Matches(PRIX_REGEX, { message: PRIX_MESSAGE })
  prixCatalogueAed?: string;

  @IsOptional()
  @Matches(POIDS_REGEX, { message: POIDS_MESSAGE })
  poidsEstimeKg?: string;

  // false : la variante n'est plus proposée (jamais supprimée)
  @IsOptional()
  @IsBoolean({ message: 'estEnVente doit être true ou false' })
  estEnVente?: boolean;
}

// PUT /admin/variantes/:id/paliers : la liste complète remplace l'ancienne ([] les retire tous)
export class DefinirPaliersDto {
  @IsArray({ message: 'paliers doit être une liste' })
  @ArrayMaxSize(10, { message: '10 paliers au plus' })
  @ValidateNested({ each: true })
  @Type(() => PalierDto)
  paliers: PalierDto[];
}
