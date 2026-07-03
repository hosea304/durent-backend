# TASK_BREAKDOWN.md — Rincian Task Build

> Daftar task untuk membangun MVP. **Update `[ ]`→`[x]` setiap task selesai** (DEVELOPMENT_RULES §9). Belum ada yang dikerjakan (masih planning). Terakhir diperbarui: 2026-07-03.
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

## Tahap 2 — Auth & Users
- [ ] Schema `users`, `customers`.
- [ ] Login staff + hash password + token; middleware role (RBAC).

## Tahap 3 — Orders + Pricing Engine ⭐
- [ ] Schema: `orders`, `order_items`.
- [ ] **Pricing Engine** (durasi, amount, rental_total, diskon, deposit, total) + **unit test paritas vs sheet**.
- [ ] **Code Generator** order (`DR-DDMMYY-NNNN`, counter dari MAX+1).
- [ ] `POST /orders/preview` & `POST /orders` (guest).
- [ ] `GET /orders` (list ringkas) + `GET /orders/{code}` (agregat) + `GET /orders/lookup`.
- [ ] `PATCH /orders/{code}`, `POST /confirm`, `POST /status`, `POST /cancel` (+ dp_disposition).
- [ ] Integrasi WhatsApp (adapter) → `whatsapp_admin_url`.

## Tahap 4 — Payments
- [ ] Schema `payments` (ledger). 
- [ ] `POST /payments` (dp/pelunasan/refund) + `GET /billing` + derive status pembayaran (default belum_lunas — D6).

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
