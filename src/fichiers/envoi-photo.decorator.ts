import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError, Observable } from 'rxjs';
import { TAILLE_MAX_PHOTO } from './images.js';

// Les erreurs de réception (en anglais chez multer) traduites pour les applis
@Injectable()
class TraduireErreursEnvoi implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((erreur: unknown) => {
        if (erreur instanceof PayloadTooLargeException) {
          throw new PayloadTooLargeException(
            `La photo dépasse ${TAILLE_MAX_PHOTO / 1024 / 1024} Mo`,
          );
        }
        if (
          erreur instanceof HttpException &&
          /Unexpected|Too many/.test(erreur.message)
        ) {
          throw new BadRequestException(
            'Envoyez une seule photo, dans le champ « photo »',
          );
        }
        throw erreur;
      }),
    );
  }
}

// @EnvoiPhoto() sur une route : elle reçoit une photo (champ « photo », 8 Mo au plus),
// gardée en mémoire le temps de la vérifier et de la compresser
export function EnvoiPhoto() {
  return applyDecorators(
    UseInterceptors(
      TraduireErreursEnvoi,
      FileInterceptor('photo', {
        limits: { fileSize: TAILLE_MAX_PHOTO, files: 1, fields: 5 },
      }),
    ),
  );
}
