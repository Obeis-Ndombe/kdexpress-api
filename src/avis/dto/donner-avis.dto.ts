import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// POST /commandes/:id/avis : la note du service, de 1 à 5
export class DonnerAvisDto {
  @IsInt({ message: 'La note doit être un nombre entier' })
  @Min(1, { message: 'La note va de 1 à 5' })
  @Max(5, { message: 'La note va de 1 à 5' })
  note: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le commentaire doit être un texte' })
  @MaxLength(1000, { message: 'Le commentaire fait 1000 caractères au plus' })
  commentaire?: string;
}
