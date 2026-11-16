import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ModificationDto {
  @IsString({ message: 'code doit être un texte' })
  @MaxLength(50, { message: 'code trop long' })
  code: string;

  // toujours un texte, même pour un nombre : "0.2725"
  @IsString({ message: 'valeur doit être un texte, ex. "0.2725"' })
  @MaxLength(255, { message: 'valeur trop longue' })
  valeur: string;
}

// PATCH /admin/parametres : plusieurs réglages changés ensemble, tous ou aucun
// { "modifications": [ { "code": "transport_mode", "valeur": "poids" },
//                      { "code": "transport_prix_kg_usd", "valeur": "8" } ] }
export class ModifierParametresDto {
  @IsArray({ message: 'modifications doit être une liste' })
  @ArrayMinSize(1, { message: 'Au moins une modification' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ModificationDto)
  modifications: ModificationDto[];
}
