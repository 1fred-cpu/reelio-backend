import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsernameGeneratorService } from '@helpers/username-generator.service';
import { JwtService } from '@helpers/jwt.service';
import { MailService } from '@helpers/mail.service';
import { SessionService } from '@helpers/session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '@entities/session.entity';
import { User } from '@entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AuthController],
  providers: [AuthService, JwtService, MailService, SessionService],
})
export class AuthModule {}
