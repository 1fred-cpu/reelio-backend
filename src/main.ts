import fastifyCors from '@fastify/cors';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  // ✅ Register CORS explicitly
  await app.register(fastifyCors as any, {
    origin: '*', // Expo dev URL
    credentials: true,
  });

  app.setGlobalPrefix('/v1/api');
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 5000, /*'0.0.0.0'*/); // ensure it listens on all interfaces
}
bootstrap();
