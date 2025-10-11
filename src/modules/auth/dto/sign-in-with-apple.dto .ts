import { IsEmail, IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class SignInWithAppleDto {
  @IsString({ message: 'fullName value must be a string type' })
  @IsNotEmpty({ message: 'fullName must not be empty' })
  fullName: string;

  @IsEmail()
  email: string;

  @IsUUID()
  authId: string;
}
