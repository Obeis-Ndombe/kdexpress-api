import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';
import { Public } from './auth/decorateurs/public.decorator.js';

@Public() // tout ce controller est ouvert
@SkipThrottle({ general: true }) // l'hébergeur l'appelle très souvent : jamais limitée
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET / : route de santé
  @Get()
  sante() {
    return this.appService.sante();
  }
}
