import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsernameGeneratorService } from '@helpers/username-generator.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsernameGeneratorService],
})
export class AuthModule {}
