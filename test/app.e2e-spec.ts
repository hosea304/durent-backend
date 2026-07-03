import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  AllExceptionsFilter,
  ErrorBody,
} from './../src/common/filters/all-exceptions.filter';

interface HealthBody {
  data: { status: string; service: string; timestamp: string };
}

describe('Scaffold (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Cerminkan konfigurasi global di main.ts
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  it('GET /api/v1/health → 200 { data: { status: ok } }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect((res.body as HealthBody).data.status).toBe('ok');
  });

  it('rute tak dikenal → 404 dengan bentuk error { error: { code, message, details } }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tidak-ada')
      .expect(404);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  afterEach(async () => {
    await app.close();
  });
});
