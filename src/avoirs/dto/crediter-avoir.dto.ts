import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// POST /avoirs : la direction crédite un client
export class CrediterAvoirDto {
  @IsInt({ message: 'idClient doit être un nombre entier' })
  @Min(1, { message: 'idClient invalide' })
  idClient: number;

  // un TEXTE comme "25.00", pour garder le montant exact
  @IsString({ message: 'montantUsd doit être un texte, ex. "25.00"' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'montantUsd doit être un montant positif avec 2 décimales au plus, ex. "25.00"',
  })
  montantUsd: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le motif doit être un texte' })
  @IsNotEmpty({ message: 'Le motif est obligatoire' })
  @MaxLength(255, { message: 'Le motif fait 255 caractères au plus' })
  motif: string;

  // facultatif : la commande à l'origine du crédit
  @IsOptional()
  @IsInt({ message: 'idCommande doit être un nombre entier' })
  @Min(1, { message: 'idCommande invalide' })
  idCommande?: number;
}
