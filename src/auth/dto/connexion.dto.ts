import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// Ce que l'utilisateur envoie pour se connecter
export class ConnexionDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être un texte' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  motDePasse: string;
}
