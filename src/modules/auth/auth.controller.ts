import { Controller, Post, Body, ValidationPipe } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignUpDto } from "./dto/sign-up.dto";
@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Post("signup")
    async signUpUser(@Body(ValidationPipe) dto: SignUpDto) {
      return this.authService.signUpUser(dto)
    }
}
