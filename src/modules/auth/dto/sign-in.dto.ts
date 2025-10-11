import { IsUUID, IsEmail } from 'class-validator';

export class SignInDto {
  @IsUUID()
  authId: string;

  @IsEmail()
  email: string;
}
