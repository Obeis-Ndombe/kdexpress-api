import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// POST /boutiques : une boutique de Dubaï où l'on achète
export class CreerBoutiqueDto {
  @Transform(nettoyer)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom de la boutique est obligatoire' })
  @MaxLength(120, { message: 'Le nom fait 120 caractères au plus' })
  nom: string;

  @IsOptional()
  @Transform(nettoyer)
  @IsString({ message: "L'adresse doit être un texte" })
  @MaxLength(255, { message: "L'adresse fait 255 caractères au plus" })
  adresse?: string;

  @IsOptional()
  @Matches(/^\+?[0-9 ]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string;
}
