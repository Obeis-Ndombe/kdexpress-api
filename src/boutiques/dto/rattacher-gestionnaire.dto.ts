import { RoleBoutique } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

// POST /admin/boutiques/:id/gestionnaires : { "idUtilisateur": 7, "role": "proprietaire" }
export class RattacherGestionnaireDto {
  @IsInt({ message: 'idUtilisateur doit être un entier' })
  @Min(1)
  idUtilisateur: number;

  @IsEnum(RoleBoutique, {
    message: 'role doit être « proprietaire » ou « vendeur »',
  })
  role: RoleBoutique;
}
