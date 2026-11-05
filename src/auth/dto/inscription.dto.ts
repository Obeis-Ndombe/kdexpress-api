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
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(80)
  nom: string;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @MaxLength(80)
  prenom: string;

  // on enlève les espaces et on met en minuscules AVANT de vérifier
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(254)
  email: string;

  @IsOptional()
  @Matches(/^\+?[0-9 ]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  @MaxLength(72) // limite de bcrypt
  motDePasse: string;
}
