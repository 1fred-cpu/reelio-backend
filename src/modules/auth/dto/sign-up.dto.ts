import { IsEmail, IsString, IsNotEmpty, IsUUID } from "class-validator";

export class SignUpDto {
    @IsString({ message: "fullName value must be a string type" })
    @IsNotEmpty({ message: "fullName must not be empty" })
    fullName: string;

    @IsEmail({ message: "Value must be a valid email" })
    email: string;

    @IsUUID({ message: "authId must be a UUID type" })
    authId: string;
}
