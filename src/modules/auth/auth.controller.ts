import { Controller, Post, Body, ValidationPipe, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/sign-up.dto';
import { FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(
    @Body(ValidationPipe) dto: SignupDto,
    @Req() request: FastifyRequest,
  ) {
    // Get user agent
    const userAgent = request.headers['user-agent'] || 'Unknown';

    // Get IP address (works behind proxy too if trust proxy is enabled)
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket.remoteAddress ||
      'Unknown';

    return this.authService.signup(dto, ipAddress, userAgent);
  }
}
