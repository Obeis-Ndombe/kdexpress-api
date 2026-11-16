import { IsString, MaxLength } from 'class-validator';

// POST /colis/pointage-scan : { "code": "KDX-C-123-7Q" } (le texte lu dans le QR)
export class PointageScanDto {
  @IsString({ message: 'code doit être le texte lu dans le QR' })
  @MaxLength(40, { message: 'Code trop long' })
  code: string;
}
