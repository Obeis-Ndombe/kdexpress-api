import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConnexionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Le mot de passe est obligatoire' })
  motDePasse: string;
}