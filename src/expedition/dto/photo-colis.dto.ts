import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// POST /colis/:id/photos : pour l'instant, le nom ou l'adresse du fichier
export class PhotoColisDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'fichier doit être un texte' })
  @IsNotEmpty({ message: 'Le fichier est obligatoire' })
  @MaxLength(500, { message: 'fichier fait 500 caractères au plus' })
  fichier: string;
}
