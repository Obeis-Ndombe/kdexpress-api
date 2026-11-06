import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/decorateurs/public.decorator.js';

@Public() // tout ce controller est ouvert
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
}
