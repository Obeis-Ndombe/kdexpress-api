import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { InscriptionDto } from './dto/inscription.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/inscription
  @Post('inscription')
  inscrire(@Body() dto: InscriptionDto) {
    return this.authService.inscrire(dto);
  }
}
