import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

// Une ligne de commande achetée, et ce qu'elle a vraiment coûté en boutique
export class LigneAcheteeDto {
  @IsInt({ message: 'idLigneCommande doit être un nombre entier' })
  @Min(1, { message: 'idLigneCommande invalide' })
  idLigneCommande: number;

  // le prix payé en boutique POUR UNE UNITÉ (comparable au prix figé du client), en texte : "235.00"
  @IsString({ message: 'prixAchatReelAed doit être un texte, ex. "235.00"' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'prixAchatReelAed doit être un montant positif avec 2 décimales au plus, ex. "235.00"',
  })
  prixAchatReelAed: string;
}

// POST /achats : un passage en caisse dans une boutique
export class EnregistrerAchatDto {
  @IsInt({ message: 'idBoutique doit être un nombre entier' })
  @Min(1, { message: 'idBoutique invalide' })
  idBoutique: number;

  @IsArray({ message: 'lignes doit être une liste' })
  @ArrayMinSize(1, { message: 'Aucune ligne achetée' })
  @ArrayMaxSize(200, { message: '200 lignes au plus par achat' })
  @ValidateNested({ each: true })
  @Type(() => LigneAcheteeDto)
  lignes: LigneAcheteeDto[];
}
