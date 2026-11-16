import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

// Le filet de sécurité : toute erreur que le code n'a pas prévue arrive ici.
// Le client reçoit un message neutre avec une référence ; le détail reste dans le journal du serveur.
@Catch()
export class ErreursFilter extends BaseExceptionFilter {
  private readonly journal = new Logger('Erreur');

  catch(erreur: unknown, hote: ArgumentsHost) {
    // les erreurs voulues (400, 401, 404, 409…) gardent leur réponse habituelle
    if (erreur instanceof HttpException) {
      return super.catch(erreur, hote);
    }
    const http = hote.switchToHttp();
    const requete = http.getRequest<Request>();
    const reponse = http.getResponse<Response>();

    // deux erreurs de base de données ont un sens clair pour le client
    if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
      if (erreur.code === 'P2002') {
        return repondre(
          reponse,
          HttpStatus.CONFLICT,
          'Cette valeur existe déjà',
        );
      }
      if (erreur.code === 'P2025') {
        return repondre(reponse, HttpStatus.NOT_FOUND, 'Élément introuvable');
      }
    }
    // une requête mal formée ou trop grosse, refusée avant d'arriver au code
    const statut = (erreur as { status?: unknown }).status;
    if (typeof statut === 'number' && statut >= 400 && statut < 500) {
      return repondre(reponse, statut, 'Requête refusée');
    }

    const reference = randomBytes(4).toString('hex');
    this.journal.error(
      `[${reference}] ${requete.method} ${requete.originalUrl}`,
      erreur instanceof Error ? erreur.stack : String(erreur),
    );
    return repondre(
      reponse,
      HttpStatus.INTERNAL_SERVER_ERROR,
      `Erreur interne. Référence à communiquer au support : ${reference}`,
    );
  }
}

function repondre(reponse: Response, statusCode: number, message: string) {
  if (reponse.headersSent) {
    return; // la réponse était déjà partie (ex. une photo en cours d'envoi)
  }
  reponse.status(statusCode).json({ statusCode, message });
}
