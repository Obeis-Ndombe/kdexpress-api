import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleUtilisateur } from '@prisma/client';

// Ce que la direction envoie pour créer un compte (agent, fournisseur, direction…)
export class CreerUtilisateurDto {
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom: string;

  @IsString({ message: 'Le prénom doit être un texte' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @MaxLength(80, { message: 'Le prénom fait 80 caractères au plus' })
  prenom: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(254, { message: "L'e-mail fait 254 caractères au plus" })
  email: string;

  @IsOptional()
  @Matches(/^\+?[0-9 ]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string;

  // le mot de passe de départ, que la personne changera
  @IsString({ message: 'Le mot de passe doit être un texte' })
  @MinLength(8, { message: 'Le mot de passe fait au moins 8 caractères' })
  @MaxLength(72, { message: 'Le mot de passe fait 72 caractères au plus' })
  motDePasse: string;

  // ici, et seulement ici, on choisit le rôle
  @IsEnum(RoleUtilisateur, {
    message: `Rôle invalide. Valeurs possibles : ${Object.values(RoleUtilisateur).join(', ')}`,
  })
  role: RoleUtilisateur;
}
