import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Ce que le client doit envoyer pour créer son compte
export class InscriptionDto {
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom: string;

  @IsString({ message: 'Le prénom doit être un texte' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @MaxLength(80, { message: 'Le prénom fait 80 caractères au plus' })
  prenom: string;

  // on enlève les espaces et on met en minuscules AVANT de vérifier
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(254, { message: "L'e-mail fait 254 caractères au plus" })
  email: string;

  @IsOptional()
  @Matches(/^\+?[0-9 ]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string;

  @IsString({ message: 'Le mot de passe doit être un texte' })
  @MinLength(8, { message: 'Le mot de passe fait au moins 8 caractères' })
  @MaxLength(72, { message: 'Le mot de passe fait 72 caractères au plus' }) // limite de bcrypt
  motDePasse: string;
}
