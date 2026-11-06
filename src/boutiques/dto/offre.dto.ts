import { IsBoolean, IsOptional, Matches } from 'class-validator';

// PUT .../offres/:idVariante : { "prixAed": "150.00", "disponible": true }
export class OffreDto {
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Prix invalide : un nombre comme "150.00"',
  })
  prixAed: string;

  // absent : disponible
  @IsOptional()
  @IsBoolean({ message: 'disponible doit être true ou false' })
  disponible?: boolean;
}
