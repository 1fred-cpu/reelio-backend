import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
    FastifyAdapter,
    NestFastifyApplication
} from "@nestjs/platform-fastify";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter()
    );
    app.setGlobalPrefix("/v1/api"); // prefix for our endpoints
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
