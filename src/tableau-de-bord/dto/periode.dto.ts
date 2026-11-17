import { IsOptional, Matches } from 'class-validator';

const JOUR = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// GET /admin/tableau-de-bord?du=2026-11-01&au=2026-11-30 (les deux jours sont compris)
export class PeriodeDto {
  @IsOptional()
  @Matches(JOUR, { message: 'du doit être une date comme 2026-11-01' })
  du?: string;

  @IsOptional()
  @Matches(JOUR, { message: 'au doit être une date comme 2026-11-30' })
  au?: string;
}
