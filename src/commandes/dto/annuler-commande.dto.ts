import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// POST /commandes/:id/annuler
export class AnnulerCommandeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le motif doit être un texte' })
  @IsNotEmpty({ message: "Le motif de l'annulation est obligatoire" })
  @MaxLength(500, { message: 'Le motif fait 500 caractères au plus' })
  motif: string;
}
