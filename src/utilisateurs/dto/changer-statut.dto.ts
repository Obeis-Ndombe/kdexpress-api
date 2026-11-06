import { IsEnum } from 'class-validator';
import { StatutCompte } from '@prisma/client';

// PATCH /utilisateurs/:id/statut  →  { "statut": "suspendu" }
export class ChangerStatutDto {
  @IsEnum(StatutCompte, {
    message: `Statut invalide. Valeurs possibles : ${Object.values(StatutCompte).join(', ')}`,
  })
  statut: StatutCompte;
}
