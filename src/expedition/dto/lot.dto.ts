import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

// POST /lots
export class CreerLotDto {
  @IsInt({ message: 'idAgenceTransport doit être un nombre entier' })
  @Min(1, { message: 'idAgenceTransport invalide' })
  idAgenceTransport: number;

  @IsArray({ message: 'colis doit être une liste de numéros de colis' })
  @ArrayMinSize(1, { message: 'Le lot est vide' })
  @ArrayMaxSize(500, { message: '500 colis au plus par envoi' })
  @IsInt({ each: true, message: 'Chaque colis est un nombre entier' })
  colis: number[];
}

// POST /lots/:id/colis
export class AjouterColisDto {
  @IsArray({ message: 'colis doit être une liste de numéros de colis' })
  @ArrayMinSize(1, { message: 'Aucun colis à ajouter' })
  @ArrayMaxSize(500, { message: '500 colis au plus par envoi' })
  @IsInt({ each: true, message: 'Chaque colis est un nombre entier' })
  colis: number[];
}

// POST /lots/:id/depart : ce que l'agence a facturé (facultatif, connu parfois plus tard)
export class DepartLotDto {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'dateDepart : une date AAAA-MM-JJ' },
  )
  dateDepart?: string;

  @IsOptional()
  @IsString({ message: 'poidsFactureKg doit être un texte, ex. "42.500"' })
  @Matches(/^\d{1,5}(\.\d{1,3})?$/, {
    message: 'poidsFactureKg : un poids en kg',
  })
  poidsFactureKg?: string;

  @IsOptional()
  @IsString({ message: 'coutFactureUsd doit être un texte, ex. "360.00"' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'coutFactureUsd : un montant en dollars',
  })
  coutFactureUsd?: string;
}

// POST /lots/:id/arrivee
export class ArriveeLotDto {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'dateArrivee : une date AAAA-MM-JJ' },
  )
  dateArrivee?: string;
}
