# TASK_BREAKDOWN.md — Rincian Task Build

> Daftar task untuk membangun MVP. **Update `[ ]`→`[x]` setiap task selesai** (DEVELOPMENT_RULES §9). Terakhir diperbarui: 2026-07-14.
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

## Tahap 5 — Penalties
- [ ] Schema `penalties`, `penalty_items`.
- [ ] `POST /penalties` (kode `-D`, kategori incl. overtime) + GET.

## Tahap 6 — Invoice & Kesiapan FE
- [ ] `GET /orders/{code}/invoice` (payload lengkap, tanpa PDF — D8).
- [ ] ~~`GET /dashboard/summary`~~ → **ditunda ke Future** (D19).
- [ ] Konsistensi format (integer rupiah, ISO, enum) + error shape + pagination di semua list.

## Tahap 7 — Cross-cutting
- [ ] Validasi (API + service) menyeluruh.
- [ ] Error handling + logging terstruktur.
- [ ] Audit log mutasi kritis (status, edit, payment, cancel).
- [ ] Rate-limit endpoint publik; gzip; eager-load anti-N+1.

## Tahap 8 — Migrasi & Go-Live
- [ ] Backup sheet; import master; set counter.
- [ ] **Uji paritas** Pricing Engine vs sheet (gate).
- [ ] Soft launch paralel → cutover (MIGRATION Tahap 4–5).

---
*(Phase 2/Future → lihat `FUTURE_ROADMAP.md`.)*
