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

  describe('Payments — ledger & status pembayaran (Tahap 4)', () => {
    let token: string;
    let orderCode: string;
    let total: number; // total_with_deposit = total_tagihan (belum ada denda)

    interface BillingBody {
      total_tagihan: number;
      total_paid: number;
      outstanding: number;
      status_pembayaran: string;
    }

    const pay = (kind: string, amount: number) =>
      request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind, amount, paid_date: '2026-08-03' });

    beforeAll(async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        })
        .expect(200);
      token = (login.body as LoginBody).data.access_token;

      const products = await request(app.getHttpServer())
        .get('/api/v1/products?type=rental&limit=1')
        .expect(200);
      const product = (products.body as { data: Array<{ code: string }> })
        .data[0];

      const created = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          customer: { name: 'Tester E2E Bayar', phone: '081200004444' },
          alamat_shooting: 'Studio E2E, Jakarta',
          purpose: 'Uji pembayaran',
          deposit_percent: 50,
          items: [
            {
              catalog_type: 'product',
              code: product.code,
              start_date: '2026-08-10',
              end_date: '2026-08-11',
              qty: 2,
            },
          ],
        })
        .expect(201);
      const data = (
        created.body as { data: { code: string; total_with_deposit: number } }
      ).data;
      orderCode = data.code;
      total = data.total_with_deposit;
    });

    it('billing awal: outstanding = total & belum_lunas (D6); tanpa token 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderCode}/billing`)
        .expect(401);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderCode}/billing`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const billing = (res.body as { data: BillingBody }).data;
      expect(billing.total_tagihan).toBe(total);
      expect(billing.total_paid).toBe(0);
      expect(billing.outstanding).toBe(total);
      expect(billing.status_pembayaran).toBe('belum_lunas');
    });

    it('DP separuh → sebagian; pelunasan sisa → lunas (paritas: dibayar ≥ tagihan)', async () => {
      const dpAmount = Math.floor(total / 2);
      const dp = await pay('dp', dpAmount).expect(201);
      expect(
        (dp.body as { data: { billing: BillingBody } }).data.billing
          .status_pembayaran,
      ).toBe('sebagian');

      const lunas = await pay('pelunasan', total - dpAmount).expect(201);
      const billing = (lunas.body as { data: { billing: BillingBody } }).data
        .billing;
      expect(billing.total_paid).toBe(total);
      expect(billing.outstanding).toBe(0);
      expect(billing.status_pembayaran).toBe('lunas');
    });

    it('detail agregat kini memuat ledger + billing nyata (D17)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderCode}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const data = (
        res.body as {
          data: {
            payments: Array<{ kind: string; amount: number }>;
            billing: BillingBody;
            status_pembayaran: string;
          };
        }
      ).data;
      expect(data.payments).toHaveLength(2);
      expect(data.billing.status_pembayaran).toBe('lunas');
      expect(data.status_pembayaran).toBe('lunas'); // dipersist di order
    });

    it('validasi: amount 0 & kind ngawur → 422', async () => {
      const res = await pay('hadiah', 0).expect(422);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    });

    it('order cancel: dp ditolak 409, refund diterima → belum_lunas (D15/D26)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dp_disposition: 'refund_full' })
        .expect(200);

      await pay('dp', 1000).expect(409);

      const refund = await pay('refund', total).expect(201);
      const billing = (refund.body as { data: { billing: BillingBody } }).data
        .billing;
      expect(billing.total_paid).toBe(0);
      expect(billing.status_pembayaran).toBe('belum_lunas');
    });
  });

  describe('Penalties — denda -D, 1 per order, masuk total tagihan (Tahap 5)', () => {
    interface BillingBody {
      total_tagihan: number;
      total_paid: number;
      outstanding: number;
      status_pembayaran: string;
    }

    let token: string;
    let orderCode: string;
    let orderTotal: number;

    const pay = (kind: string, amount: number) =>
      request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind, amount, paid_date: '2026-08-22' });

    const penaltyBody = {
      items: [
        {
          product_name: 'Handy Talky',
          product_code: 'DS-RT-CM-HT-0001',
          category: 'kerusakan',
          reason: 'Antena patah saat pengembalian',
          qty: 1,
          denda_per_qty: 75_000,
        },
        {
          product_name: 'Runner',
          product_code: 'DS-CW-RN-0001',
          category: 'overtime',
          reason: 'Lembur 2 jam',
          qty: 2,
          denda_per_qty: 50_000, // aturan overtime kru (D4)
        },
      ],
    };
    const dendaTotal = 75_000 + 2 * 50_000; // 175.000

    beforeAll(async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        })
        .expect(200);
      token = (login.body as LoginBody).data.access_token;

      const products = await request(app.getHttpServer())
        .get('/api/v1/products?type=rental&limit=1')
        .expect(200);
      const product = (products.body as { data: Array<{ code: string }> })
        .data[0];

      const created = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          customer: { name: 'Tester E2E Denda', phone: '081200005555' },
          alamat_shooting: 'Studio E2E, Jakarta',
          purpose: 'Uji denda',
          deposit_percent: 0,
          items: [
            {
              catalog_type: 'product',
              code: product.code,
              start_date: '2026-08-20',
              end_date: '2026-08-20',
              qty: 1,
            },
          ],
        })
        .expect(201);
      const data = (
        created.body as { data: { code: string; total_with_deposit: number } }
      ).data;
      orderCode = data.code;
      orderTotal = data.total_with_deposit;
    });

    it('tanpa token → 401; buat denda → 201 dengan grand_total = Σ qty×denda_per_qty', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/penalties`)
        .send(penaltyBody)
        .expect(401);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/penalties`)
        .set('Authorization', `Bearer ${token}`)
        .send(penaltyBody)
        .expect(201);
      const data = (
        res.body as {
          data: { code: string; grand_total: number; items: unknown[] };
        }
      ).data;
      expect(data.code).toBe(`${orderCode}-D`);
      expect(data.grand_total).toBe(dendaTotal);
      expect(data.items).toHaveLength(2);
    });

    it('denda kedua pada order yang sama ditolak 409 (D14: 1 per order)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderCode}/penalties`)
        .set('Authorization', `Bearer ${token}`)
        .send(penaltyBody)
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe('CONFLICT');
    });

    it('billing order kini menghitung denda ke total_tagihan', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderCode}/billing`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const billing = (
        res.body as { data: { total_tagihan: number; outstanding: number } }
      ).data;
      expect(billing.total_tagihan).toBe(orderTotal + dendaTotal);
      expect(billing.outstanding).toBe(orderTotal + dendaTotal);
    });

    it('detail agregat order memuat penalties[]; GET /penalties/{code} berisi billing', async () => {
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderCode}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const penalties = (
        detail.body as { data: { penalties: Array<{ code: string }> } }
      ).data.penalties;
      expect(penalties).toHaveLength(1);
      expect(penalties[0].code).toBe(`${orderCode}-D`);

      const byCode = await request(app.getHttpServer())
        .get(`/api/v1/penalties/${orderCode}-D`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const data = (
        byCode.body as {
          data: { billing: { total_tagihan: number } };
        }
      ).data;
      expect(data.billing.total_tagihan).toBe(orderTotal + dendaTotal);
    });

    it('pelunasan penuh (order + denda) → status lunas', async () => {
      const res = await pay('pelunasan', orderTotal + dendaTotal).expect(201);
      const billing = (res.body as { data: { billing: BillingBody } }).data
        .billing;
      expect(billing.status_pembayaran).toBe('lunas');
    });

    it('order cancel tidak bisa diberi denda baru', async () => {
      const other = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          customer: { name: 'Tester E2E Denda Cancel', phone: '081200006666' },
          alamat_shooting: 'Studio E2E, Jakarta',
          purpose: 'Uji denda order cancel',
          items: [
            {
              catalog_type: 'product',
              code: 'DS-RT-CM-HT-0001',
              start_date: '2026-08-21',
              end_date: '2026-08-21',
              qty: 1,
            },
          ],
        })
        .expect(201);
      const cancelCode = (other.body as { data: { code: string } }).data.code;

      await request(app.getHttpServer())
        .post(`/api/v1/orders/${cancelCode}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dp_disposition: 'none' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/${cancelCode}/penalties`)
        .set('Authorization', `Bearer ${token}`)
        .send(penaltyBody)
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe('CONFLICT');
    });
  });
});
