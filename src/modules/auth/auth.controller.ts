import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignInWithGoogleDto } from './dto/sign-in-with-google.dto';
import { SignInWithAppleDto } from './dto/sign-in-with-apple.dto ';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUpUser(@Body(ValidationPipe) dto: SignUpDto) {
    return this.authService.signUpUser(dto);
  }

  @Post('signin')
  async signInUser(@Body(ValidationPipe) dto: SignInDto) {
    return this.authService.signInUser(dto);
  }

  @Post('signin-with-google')
  async signInWithGoogle(@Body(ValidationPipe) dto: SignInWithGoogleDto) {
    return this.authService.signInWithGoogle(dto);
  }

  @Post('signin-with-apple')
  async signInWithApple(@Body(ValidationPipe) dto: SignInWithAppleDto) {
    return this.authService.signInWithApple(dto);
  }
}
