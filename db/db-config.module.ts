import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', //
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('SUPABASE_DATABASE_HOST'),
        port: Number(config.get<string>('SUPABASE_DATABASE_PORT')) || 5432,
        username: config.get<string>('SUPABASE_DATABASE_USER') || 'postgres',
        password: config.get<string>('SUPABASE_DATABASE_PASSWORD'),
        database: config.get<string>('SUPABASE_DATABASE_NAME') || 'postgres',
        entities: [__dirname + '/dist/entities/**/*.entity{.ts,.js}'],
        // migrations: [__dirname + '/dist/db/migrations/**/*{.ts,.js}'],
        ssl: {
          rejectUnauthorized: false,
        },
        synchronize: false, //
        logging: true,
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseConfig {}
