import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// POST /agences : une agence de transport Dubaï → Kinshasa
export class CreerAgenceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: "Le nom de l'agence est obligatoire" })
  @MaxLength(120, { message: 'Le nom fait 120 caractères au plus' })
  nom: string;

  @IsOptional()
  @Matches(/^\+?[0-9 ]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string;

  // ce que l'agence nous facture par kilo, en texte : "8.50"
  @IsOptional()
  @IsString({ message: 'tarifKgUsd doit être un texte, ex. "8.50"' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'tarifKgUsd doit être un montant positif avec 2 décimales au plus',
  })
  tarifKgUsd?: string;
}
