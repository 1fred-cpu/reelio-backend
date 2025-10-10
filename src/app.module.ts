import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseConfig } from '../db/db-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: './env',
      isGlobal: true,
    }), // Makes environment variables accessible all over
    DatabaseConfig, // Configure settings for database
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
