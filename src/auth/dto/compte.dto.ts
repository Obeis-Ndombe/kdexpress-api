import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const enMinuscules = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const sansEspaces = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// PATCH /auth/moi : seuls les champs envoyés changent
export class ModifierProfilDto {
  @IsOptional()
  @Transform(sansEspaces)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide' })
  @MaxLength(80, { message: 'Le nom fait 80 caractères au plus' })
  nom?: string;

  @IsOptional()
  @Transform(sansEspaces)
  @IsString({ message: 'Le prénom doit être un texte' })
  @IsNotEmpty({ message: 'Le prénom ne peut pas être vide' })
  @MaxLength(80, { message: 'Le prénom fait 80 caractères au plus' })
  prenom?: string;

  // null : effacer le numéro
  @ValidateIf((dto: ModifierProfilDto) => dto.telephone !== null)
  @IsOptional()
  @Matches(/^\+?[0-9 ]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string | null;
}

// POST /auth/mot-de-passe : changer son mot de passe quand on le connaît
export class ChangerMotDePasseDto {
  @IsString({ message: 'Le mot de passe actuel doit être un texte' })
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  @MaxLength(72, { message: 'Le mot de passe fait 72 caractères au plus' })
  motDePasseActuel: string;

  @IsString({ message: 'Le nouveau mot de passe doit être un texte' })
  @MinLength(8, { message: 'Le mot de passe fait au moins 8 caractères' })
  @MaxLength(72, { message: 'Le mot de passe fait 72 caractères au plus' }) // limite de bcrypt
  nouveauMotDePasse: string;
}

// POST /auth/mot-de-passe-oublie
export class MotDePasseOublieDto {
  @Transform(enMinuscules)
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(254, { message: "L'e-mail fait 254 caractères au plus" })
  email: string;
}

// POST /auth/mot-de-passe-reinitialise : le code reçu par e-mail + le nouveau mot de passe
export class ReinitialiserMotDePasseDto {
  @Transform(enMinuscules)
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(254, { message: "L'e-mail fait 254 caractères au plus" })
  email: string;

  @Transform(sansEspaces)
  @Matches(/^\d{6}$/, { message: 'Le code fait 6 chiffres' })
  code: string;

  @IsString({ message: 'Le nouveau mot de passe doit être un texte' })
  @MinLength(8, { message: 'Le mot de passe fait au moins 8 caractères' })
  @MaxLength(72, { message: 'Le mot de passe fait 72 caractères au plus' })
  nouveauMotDePasse: string;
}
