import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
} from '../../admin-catalogue/dto/commun.js';
import { ValeurCaracteristiqueDto } from '../../admin-catalogue/dto/produit.dto.js';

// Une variante proposée : le fournisseur donne SON prix (prix boutique).
// Le prix client et les paliers sont l'affaire de la direction.
export class VariantePropositionDto {
  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: 'Le libellé doit être un texte' })
  @IsNotEmpty({ message: 'Le libellé ne peut pas être vide' })
  @MaxLength(120, { message: 'Le libellé fait 120 caractères au plus' })
  libelle?: string;

  @Matches(PRIX_REGEX, { message: PRIX_MESSAGE })
  prixBoutiqueAed: string;

  @IsOptional()
  @Matches(POIDS_REGEX, { message: POIDS_MESSAGE })
  poidsEstimeKg?: string;

  @IsOptional()
  @IsArray({ message: 'options doit être une liste' })
  @ArrayMaxSize(10, { message: '10 options au plus' })
  @ValidateNested({ each: true })
  @Type(() => ValeurCaracteristiqueDto)
  options?: ValeurCaracteristiqueDto[];
}

// POST /fournisseur/boutiques/:id/produits
export class PropositionProduitDto {
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
  @Type(() => VariantePropositionDto)
  variantes: VariantePropositionDto[];
}

// PATCH /fournisseur/boutiques/:id/produits/:idProduit : tant que la proposition est en attente
export class ModifierPropositionDto {
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
}
