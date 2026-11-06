import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

// POST /retraits : le code présenté par le client au guichet
export class RemettreDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Le code de retrait doit être un texte' })
  @Matches(/^[A-Z0-9]{4,12}$/, { message: 'Code de retrait invalide' })
  codeRetrait: string;
}
