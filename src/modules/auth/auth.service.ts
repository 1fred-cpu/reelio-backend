import { Injectable } from "@nestjs/common";
import { SignUpDto } from "./dto/sign-up.dto";
import { DataSource } from "typeorm";
import { ConflictException } from "@exceptions/app.exception";
import { User } from "@entities/user.entity";
import { UsernameGeneratorService } from "@helpers/username-generator.service";
@Injectable()
export class AuthService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly usernameGenerator: UsernameGeneratorService
    ) {}

    async signUpUser(dto: SignUpDto) {
        return this.dataSource.transaction(async manager => {
            const { fullName, email, authId } = dto;

            // 1. Check user already exists
            const existingUser = await manager.findOne(User, {
                where: {
                    email
                }
            });
            if (existingUser) {
                throw new ConflictException(
                    "A user already exists with this credentials"
                );
            }

            // 2. Create a new user record
            const user = manager.create(User, {
                full_name: fullName,
                email,
                auth_id: authId,
                username: this.usernameGenerator.generate(fullName)
            });

            const newUser = await manager.save(user);
            return {
                fullName,
                email,
                authId,
                role: newUser.role,
                username: newUser.username,
                avatarUrl: newUser.avatar_url,
                preferences: newUser.preferences
            };
        });
    }
}
