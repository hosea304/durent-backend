import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1'); // Base URL sesuai API_CONTRACT §1
  app.enableCors(); // origin dibatasi saat deploy (frontend belum ada)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // buang field di luar DTO
      transform: true, // string query/param → tipe DTO
      // API_CONTRACT: validasi gagal = 422 (default Nest 400)
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DuRent Support API')
    .setDescription(
      'Backend rental kebutuhan produksi film/event. Kontrak: docs/API_CONTRACT.md',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
