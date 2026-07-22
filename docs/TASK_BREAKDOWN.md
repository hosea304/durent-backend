# TASK_BREAKDOWN.md — Rincian Task Build

> Daftar task untuk membangun MVP. **Update `[ ]`→`[x]` setiap task selesai** (DEVELOPMENT_RULES §9). Terakhir diperbarui: 2026-07-22.
>
> Status: ⬜ belum · 🟡 jalan · ✅ selesai.

---

## Tahap 0 — Fondasi (pra-coding)
- [x] **Tech stack dipilih (D20):** NestJS + Prisma (TypeScript) + PostgreSQL; hosting free-tier (Render/Railway + Neon/Supabase). Lihat `TECH_STACK.md`.
- [x] Endpoint usulan diputuskan (D19): `POST /orders/preview` **diambil (MVP)**; `GET /dashboard/summary` **ditunda (Future)**.
- [x] Konfirmasi field `orders.confirmed_at`/`confirmed_by` — **diterima pemilik (2026-07-03)**, sudah tercantum di DATA_MODEL §3.5.
- [x] Scaffold proyek (2026-07-03, D21): struktur modular monolith NestJS (8 modul domain kosong + `common/` + `PrismaService`), config env (`@nestjs/config` + `.env.example`), Prisma 7 + PostgreSQL (koneksi lazy; DB nyata = **Supabase free tier, session pooler** — terisi di `.env` & teruji 2026-07-03 via pg + Prisma CLI), exception filter `{error:{...}}`, ValidationPipe 422, Swagger `/api/docs`, throttler, logger pino, health check `GET /api/v1/health`. Verifikasi: build + unit + e2e + lint hijau, server jalan.

## Tahap 1 — Master / Catalog ✅ (2026-07-03, D22)
- [x] Schema + migrasi `init_catalog`: `code_segments`, `products`, `vouchers`, `bundles`, `bundle_items` (+ `bundles.category_utama_code`/`code_number` untuk kode `DS-BI-…`).
- [x] Service kode produk (`ProductCodeService`): susun kode dari segmen, nomor MAX+1 per kombinasi, unik & tak reuse (D12) + unit test.
- [x] CRUD produk/bundling/voucher (admin) + soft delete + `preview-code` + `GET /code-segments`. ⚠️ Belum ada guard (Tahap 2) — dev-only, disetujui pemilik.
- [x] Endpoint katalog publik `GET /products`, `/bundles` (+detail by code): hanya aktif, paging+meta, `original_price`, Cache-Control 60s + ETag.
- [x] Seed `code_segments` (72 kode incl. `BI`) + **import master dari sheet asli**: 100 produk, 8 bundle (24 komponen), 36 voucher — script idempotent `prisma/import-master.ts` & `import-vouchers.ts`. Perbaikan data: kode kembar `DS-CW-OT-DC` → `-0001`/`-0002`. Field turunan (pricing_basis, unit_label, min_qty, is_returnable) diisi aturan MIGRATION §4 — **perlu review pemilik sebelum katalog dipublikasikan**.

## Tahap 2 — Auth & Users ✅ (2026-07-06, D24)
- [x] Schema `users` (role admin/gudang/owner) + `customers` (guest, index phone) — migrasi `auth_users_customers`.
- [x] Login staff: `POST /auth/login` (throttle 5x/menit) → JWT (exp `JWT_EXPIRES_IN`, default 1d) + `GET /auth/me` + `POST /auth/logout` (stateless). Hash **argon2**; validasi token ke DB tiap request (user nonaktif langsung tertolak). RBAC `JwtAuthGuard`+`RolesGuard`+`@Roles` — 4 controller admin katalog dikunci `admin`+`owner`. Akun pertama (owner) via seed dari env. Tanpa CRUD user API (tidak ada di API_CONTRACT §3). Test: 16 unit + 6 e2e + tester 12 cek — hijau.

## Tahap 3 — Orders + Pricing Engine ⭐ ✅ (2026-07-14, D25)
- [x] Schema: `orders`, `order_items` (+ kolom teknis `code_number`, `line_no` — D25) — migrasi `orders_order_items` **diterapkan** ke Supabase.
- [x] **Pricing Engine** (`pricing-engine.ts`, fungsi murni): durasi inklusif, amount, rental_total, diskon persen/nominal per-baris, deposit pra-diskon, total + **15 unit test paritas vs formula sheet**.
- [x] **Code Generator** order (`DR-DDMMYY-NNNN`): counter GLOBAL MAX+1 dari `code_number`, tanggal WIB, retry saat bentrok + unit test.
- [x] `POST /orders/preview` & `POST /orders` (guest, throttle 30×/5×per menit): snapshot harga, dedup customer by phone, validasi (tanggal, aktif, min_qty catering, voucher case-insensitive).
- [x] `GET /orders` (ringkas + filter status/payment/q/from/to + `?include=items`) + `GET /orders/{code}` (agregat: items+billing; payments/penalties kosong s.d. Tahap 4–5) + `GET /orders/lookup` (kode+phone, 404 tunggal).
- [x] `PATCH /orders/{code}` (recompute; code & invoice_date tetap; items = replace-all), `POST /confirm` (idempoten, isi confirmed_at/by), `POST /status` (admin+gudang), `POST /cancel` (+ dp_disposition; order cancel menolak aksi lain 409).
- [x] Integrasi WhatsApp (adapter, env `ADMIN_WA_NUMBER`) → `whatsapp_admin_url` di respons booking.
- [x] Verifikasi: build + lint + 38 unit test + 12 e2e (+6 skenario orders) hijau; api-tester +9 tes (total 25).

## Tahap 4 — Payments ✅ (2026-07-14, D26)
- [x] Schema `payments` (ledger: kind dp/pelunasan/refund, amount positif, paid_date, note; + `created_at` teknis) — migrasi `payments` diterapkan.
- [x] `POST /orders/{code}/payments` (recompute status tiap mutasi; order cancel hanya menerima refund) + `GET /payments` + `GET /billing` (total_tagihan/total_paid/outstanding) + derive status belum_lunas/sebagian/lunas (D6; fungsi murni `payment-status.ts` + 10 unit test paritas). Detail agregat order kini memuat ledger nyata; PATCH order me-recompute status. Verifikasi: 48 unit + 17 e2e hijau; api-tester +2 tes (total 27).

## Tahap 5 — Penalties ✅ (2026-07-14, D27)
- [x] Schema `penalties` (1:1 order, kode `{order}-D`), `penalty_items` (+ `line_no` teknis) — migrasi `penalties` diterapkan. `status_transaksi`/`status_pembayaran` TIDAK disimpan ganda — derived dari order induk saat respons.
- [x] `POST /orders/{code}/penalties` (SATU per order — D14, order cancel ditolak, denda kedua → 409) + `GET /orders/{code}/penalties` (array 0/1) + `GET /penalties/{code}` (detail + billing). Kategori incl. **overtime** (D4). `grand_total = Σ qty×denda_per_qty`, menambah `total_tagihan` → status pembayaran order di-recompute (juga terintegrasi ke billing/payments & detail agregat `GET /orders/{code}`). Verifikasi: 51 unit + 23 e2e hijau; api-tester +3 tes (total 30).

## Tahap 6 — Invoice & Kesiapan FE ✅ (2026-07-15, D28)
- [x] `GET /orders/{code}/invoice` — alias murni dari detail agregat order (payload lengkap: header+items+totals+deposit+denda+ringkas bayar, tanpa PDF — D8).
- [x] ~~`GET /dashboard/summary`~~ → **ditunda ke Future** (D19).
- [x] Konsistensi format diaudit — uang/tanggal/enum/error shape sudah konsisten sejak awal; `meta:{total}` ditambahkan ke `GET .../payments` & `GET .../penalties` (list terikat-order, tanpa page/limit — pola code-segments). Verifikasi: 51 unit + 27 e2e hijau; api-tester +1 tes (31 total).

## Tahap 7 — Cross-cutting 🟡 (2026-07-22, D29 — audit log ditunda)
- [x] **Validasi (API + service) menyeluruh** — sweep semua DTO: batas atas defensif (qty ≤ 1jt, rupiah/harga ≤ 1M, items ≤ 100/order) cegah overflow & payload raksasa; `MaxLength` semua free-text (alamat/purpose/kode/nama/unit_label); password login ≤ 200 (cegah DoS hashing).
- [x] **Error handling + logging terstruktur** — `AllExceptionsFilter` memetakan error Prisma (P2002→409, P2025→404, P2003→409; pesan generik, tak bocor) sebelum fallback 500; pino `genReqId` (hormati/echo `x-request-id`) + log 5xx berprefix `[req:<id>]`. Spec filter 8 tes.
- [ ] ~~Audit log mutasi kritis~~ → **DITUNDA ke Future** (D29, keputusan pemilik) — `activity_logs` tetap Future (DATA_MODEL §4).
- [x] **Rate-limit endpoint publik; gzip; eager-load anti-N+1** — gzip via `compression`; rate-limit publik sudah lengkap (D25); anti-N+1 direview (bulk `findMany`+Map, `Promise.all`, `_count`) — sudah baik, tanpa perubahan.
- Verifikasi: build + lint hijau; unit 59/59 hijau (+8 filter). e2e menunggu DB Supabase aktif (paused).

## Tahap 8 — Migrasi & Go-Live 🟡 (2026-07-22, D30 — model dual-channel `-W`)
- [x] **Import master** — sudah di Tahap 1 (100 produk, 8 bundle, 36 voucher).
- [x] ~~Set counter dari MAX sheet~~ → **TIDAK PERLU** (D30): order website ber-suffix `-W` → ruang nomor terpisah, mulai 0001 sendiri. Generator kode + e2e diupdate ke `-W`.
- [x] **Harness uji paritas** Pricing Engine vs sheet (gate MG2) — `prisma/parity-check.ts` + `npm run parity` + template `parity-samples.example.json` (FAIL → exit 1). *Menjalankan gate butuh data order NYATA dari pemilik.*
- [ ] **Backup + snapshot spreadsheet** (Stage 0) — **pemilik**.
- [ ] **Isi `parity-samples.json`** (order historis nyata) → jalankan `npm run parity` sampai LULUS — **pemilik** (data) + gate.
- [ ] **Count/spot check** katalog backend vs sheet — butuh DB Supabase aktif (saat ini paused).
- [ ] **Soft launch** website paralel dengan spreadsheet (bukan cutover — D30) — **pemilik** (deploy).

---
*(Phase 2/Future → lihat `FUTURE_ROADMAP.md`.)*
