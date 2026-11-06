import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { nettoyer } from './commun.js';

// POST /admin/marques
export class CreerMarqueDto {
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom de la marque est obligatoire' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom: string;
}

// POST /admin/caracteristiques : « Contenance » avec l'unité « ml »
export class CreerCaracteristiqueDto {
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom de la caractéristique est obligatoire' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom: string;

  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: "L'unité doit être un texte" })
  @IsNotEmpty({ message: "L'unité ne peut pas être vide" })
  @MaxLength(20, { message: "L'unité fait 20 caractères au plus" })
  unite?: string;
}
