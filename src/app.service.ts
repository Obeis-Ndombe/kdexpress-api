import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // La réponse de GET / : l'hébergeur s'en sert pour savoir si l'API est en vie
  sante() {
    return { nom: 'KDExpress API', statut: 'ok' };
  }
}
