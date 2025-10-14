import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsOptional()
  fullName?: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
