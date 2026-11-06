import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MoyenPaiement, ObjetPaiement } from '@prisma/client';

// POST /commandes/:id/paiements
export class EnregistrerPaiementDto {
  @IsEnum(ObjetPaiement, {
    message: `Objet invalide. Valeurs possibles : ${Object.values(ObjetPaiement).join(', ')}`,
  })
  objet: ObjetPaiement;

  @IsEnum(MoyenPaiement, {
    message: `Moyen invalide. Valeurs possibles : ${Object.values(MoyenPaiement).join(', ')}`,
  })
  moyen: MoyenPaiement;

  // un TEXTE comme "874.88" : on garde le montant exact, sans passer par un nombre à virgule
  @IsString({ message: 'montantUsd doit être un texte, ex. "874.88"' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'montantUsd doit être un montant positif avec 2 décimales au plus, ex. "874.88"',
  })
  montantUsd: string;

  // la référence de la transaction mobile money ou carte
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La référence doit être un texte' })
  @IsNotEmpty({ message: 'La référence ne peut pas être vide' })
  @MaxLength(100, { message: 'La référence fait 100 caractères au plus' })
  reference?: string;
}
