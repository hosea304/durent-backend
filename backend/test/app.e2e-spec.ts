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

  describe('Orders + Pricing Engine (Tahap 3)', () => {
    const PHONE = '081200003333';
    let token: string;
    let product: { code: string; base_price: number };
    let orderCode: string;

    const bookingBody = (items: unknown[]) => ({
      customer: { name: 'Tester E2E', phone: PHONE },
      alamat_shooting: 'Studio E2E, Jakarta',
      purpose: 'Uji end-to-end',
      deposit_percent: 50,
      items,
    });

    beforeAll(async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        })
        .expect(200);
      token = (login.body as LoginBody).data.access_token;

      // bahan tes: 1 produk rental aktif dari master hasil import
      const products = await request(app.getHttpServer())
        .get('/api/v1/products?type=rental&limit=1')
        .expect(200);
      const body = products.body as {
        data: Array<{ code: string; base_price: number }>;
      };
      expect(body.data.length).toBeGreaterThan(0);
      product = body.data[0];
    });

    it('preview: hitung tanpa menyimpan — paritas rumus sheet', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/preview')
        .send(
          bookingBody([
            {
              catalog_type: 'product',
              code: product.code,
              start_date: '2026-08-01',
              end_date: '2026-08-02', // durasi 2 hari inklusif
              qty: 2,
            },
          ]),
        )
        .expect(200);
      const data = (
        res.body as {
          data: {
            items: Array<{ duration: number; rental_total: number }>;
            grand_total: number;
            deposit_amount: number;
            total_with_deposit: number;
          };
        }
      ).data;
      const rental = 2 * 2 * product.base_price;
      expect(data.items[0].duration).toBe(2);
      expect(data.items[0].rental_total).toBe(rental);
      expect(data.grand_total).toBe(rental);
      expect(data.deposit_amount).toBe(Math.round(rental / 2)); // 50%
      expect(data.total_with_deposit).toBe(
        data.grand_total + data.deposit_amount,
      );
    });

    it('validasi: tanggal terbalik & produk tak dikenal → 422 + details', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/preview')
        .send(
          bookingBody([
            {
              catalog_type: 'product',
              code: product.code,
              start_date: '2026-08-05',
              end_date: '2026-08-01',
              qty: 1,
            },
            {
              catalog_type: 'product',
              code: 'DS-XX-YY-ZZ-9999',
              start_date: '2026-08-01',
              end_date: '2026-08-01',
              qty: 1,
            },
          ]),
        )
        .expect(422);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details.length).toBeGreaterThanOrEqual(2);
    });

    it('booking guest → 201: kode DR-, snapshot & total, pending/belum_lunas (⭐)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send(
          bookingBody([
            {
              catalog_type: 'product',
              code: product.code,
              start_date: '2026-08-01',
              end_date: '2026-08-02',
              qty: 2,
            },
          ]),
        )
        .expect(201);
      const data = (
        res.body as {
          data: {
            code: string;
            status_transaksi: string;
            status_pembayaran: string;
            confirmed_at: string | null;
            items: Array<{ unit_price: number; line_no: number }>;
            grand_total: number;
          };
        }
      ).data;
      expect(data.code).toMatch(/^DR-\d{6}-\d{4,}$/);
      expect(data.status_transaksi).toBe('pending');
      expect(data.status_pembayaran).toBe('belum_lunas'); // D6
      expect(data.confirmed_at).toBeNull(); // D1: belum dikonfirmasi
      expect(data.items[0].unit_price).toBe(product.base_price); // snapshot
      expect('whatsapp_admin_url' in data).toBe(true);
      orderCode = data.code;
    });

    it('lookup guest: kode+phone cocok → ringkas; phone salah → 404', async () => {
      const ok = await request(app.getHttpServer())
        .get('/api/v1/orders/lookup')
        .query({ code: orderCode, phone: PHONE })
        .expect(200);
      expect(
        (ok.body as { data: { status_transaksi: string } }).data
          .status_transaksi,
      ).toBe('pending');

      await request(app.getHttpServer())
        .get('/api/v1/orders/lookup')
        .query({ code: orderCode, phone: '089999999999' })
        .expect(404);
    });

    it('admin: list terfilter & detail agregat (items+billing+payments+penalties)', async () => {
      await request(app.getHttpServer()).get('/api/v1/orders').expect(401);

      const list = await request(app.getHttpServer())
        .get('/api/v1/orders?status=pending&limit=5')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        (list.body as { meta: { total: number } }).meta.total,
      ).toBeGreaterThanOrEqual(1);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderCode}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const data = (
        detail.body as {
          data: {
            items: unknown[];
            billing: { outstanding: number; total_tagihan: number };
            payments: unknown[];
            penalties: unknown[];
          };
        }
      ).data;
      expect(Array.isArray(data.items)).toBe(true);
      expect(Array.isArray(data.payments)).toBe(true);
      expect(Array.isArray(data.penalties)).toBe(true);
      expect(data.billing.outstanding).toBe(data.billing.total_tagihan);
    });

    it('admin: confirm → status on_progress → cancel (+dp_disposition, D15)', async () => {
      const confirm = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        (confirm.body as { data: { confirmed_at: string | null } }).data
          .confirmed_at,
      ).not.toBeNull();

      const status = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'on_progress' })
        .expect(200);
      expect(
        (status.body as { data: { status_transaksi: string } }).data
          .status_transaksi,
      ).toBe('on_progress');

      const cancel = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dp_disposition: 'none' })
        .expect(200);
      expect(
        (cancel.body as { data: { status_transaksi: string } }).data
          .status_transaksi,
      ).toBe('cancel');

      // order yang sudah cancel menolak aksi lanjutan (409)
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' })
        .expect(409);
    });
  });
});
