# TASK_BREAKDOWN.md — Rincian Task Build

> Daftar task untuk membangun MVP. **Update `[ ]`→`[x]` setiap task selesai** (DEVELOPMENT_RULES §9). Belum ada yang dikerjakan (masih planning). Terakhir diperbarui: 2026-07-03.
>
> Status: ⬜ belum · 🟡 jalan · ✅ selesai.

---

## Tahap 0 — Fondasi (pra-coding)
- [x] **Tech stack dipilih (D20):** NestJS + Prisma (TypeScript) + PostgreSQL; hosting free-tier (Render/Railway + Neon/Supabase). Lihat `TECH_STACK.md`.
- [x] Endpoint usulan diputuskan (D19): `POST /orders/preview` **diambil (MVP)**; `GET /dashboard/summary` **ditunda (Future)**.
- [ ] Konfirmasi field `orders.confirmed_at`/`confirmed_by` (belum ada penolakan — dianggap diterima kecuali diubah).
- [ ] Scaffold proyek: struktur modular monolith (layer API/Service/Repository), config env, koneksi DB.

## Tahap 1 — Master / Catalog
- [ ] Schema + migrasi: `code_segments`, `products`, `vouchers`, `bundles`, `bundle_items`.
- [ ] Service kode produk (susun `code`, jamin unik & tak reuse — D12).
- [ ] CRUD produk/bundling/voucher (admin) + soft delete.
- [ ] Endpoint katalog publik (`GET /products`, `/bundles`) + cache (ETag).
- [ ] Seed `code_segments` + import master dari sheet (MIGRATION Tahap 1–2).

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
