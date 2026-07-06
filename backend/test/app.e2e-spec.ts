import 'dotenv/config';
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

interface LoginBody {
  data: { access_token: string; user: { email: string; role: string } };
}

describe('Backend DuRent (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
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

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 { data: { status: ok } }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect((res.body as HealthBody).data.status).toBe('ok');
  });

  it('rute tak dikenal → 404 bentuk { error: { code, message, details } }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tidak-ada')
      .expect(404);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  describe('Auth & RBAC (Tahap 2)', () => {
    it('kredensial salah → 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'bukan@siapa.pun', password: 'ngasal' })
        .expect(401);
      expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
    });

    it('endpoint admin tanpa token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vouchers')
        .expect(401);
      expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
    });

    it('login owner → me → akses endpoint admin dengan token', async () => {
      const email = process.env.ADMIN_EMAIL;
      const password = process.env.ADMIN_PASSWORD;
      expect(email).toBeDefined();
      expect(password).toBeDefined();

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const { access_token, user } = (login.body as LoginBody).data;
      expect(access_token.length).toBeGreaterThan(20);
      expect(user.role).toBe('owner');

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      expect((me.body as { data: { email: string } }).data.email).toBe(email);

      const preview = await request(app.getHttpServer())
        .post('/api/v1/products/preview-code')
        .set('Authorization', `Bearer ${access_token}`)
        .send({
          type: 'rental',
          category_utama_code: 'CM',
          sub_category_code: 'HT',
        })
        .expect(201);
      expect((preview.body as { data: { code: string } }).data.code).toMatch(
        /^DS-RT-CM-HT-\d{4}$/,
      );
    });

    it('token ngawur → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token-palsu')
        .expect(401);
      expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
    });
  });
});
