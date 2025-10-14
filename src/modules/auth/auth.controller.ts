import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Req,
  Query,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/sign-up.dto';
import { SigninDto } from './dto/sign-in.dto';
import { FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /* =============================================================
   * SIGN UP
   * ============================================================= */
  @Post('signup')
  async signup(
    @Body(ValidationPipe) dto: SignupDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.signup(dto, ipAddress, userAgent);
  }

  /* =============================================================
   * SIGN IN
   * ============================================================= */
  @Post('signin')
  async signin(
    @Body(ValidationPipe) dto: SigninDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.signin(dto, ipAddress, userAgent);
  }

  /* =============================================================
   * SIGN IN WITH GOOGLE
   * ============================================================= */
  @Post('signin-with-google')
  async signinWithGoogle(
    @Body() dto: { idToken: string },
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const { idToken } = dto;
    return this.authService.signinWithGoogle({
      idToken,
      ipAddress,
      userAgent,
    });
  }

  /* =============================================================
   * VERIFY EMAIL
   * ============================================================= */
  @Post('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.verifyEmail(token, ipAddress, userAgent);
  }

  /* =============================================================
   * REFRESH ACCESS TOKEN
   * ============================================================= */
  @Post('refresh-token')
  async refreshAccessToken(
    @Body()
    dto: {
      userId: string;
      refreshToken: string;
    },
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const { userId, refreshToken } = dto;
    return this.authService.refreshAccessToken({
      userId,
      refreshToken,
      ipAddress,
      userAgent,
    });
  }

  /* =============================================================
   * REQUEST PASSWORD RESET
   * ============================================================= */
  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.requestPasswordReset(email);
  }

  /* =============================================================
   * RESET PASSWORD
   * ============================================================= */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    return this.authService.resetPassword(token, newPassword);
  }
}
