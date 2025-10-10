import { DataSource } from 'typeorm';
import 'dotenv/config';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.SUPABASE_DATABASE_HOST,
  port: Number(process.env.SUPABASE_DATABASE_PORT),
  username: process.env.SUPABASE_DATABASE_USER,
  password: process.env.SUPABASE_DATABASE_PASSWORD,
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: false,
  logging: true,
  entities: ['dist/entities/**/*.js'],
  migrations: ['dist/db/migrations/*.js'],
});
