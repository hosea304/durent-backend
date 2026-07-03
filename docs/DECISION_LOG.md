# DECISION_LOG.md — Riwayat Keputusan Teknis & Bisnis

> Setiap keputusan penting dicatat di sini: **ID, tanggal, keputusan, alasan, dampak, status**. Jangan ubah keputusan yang sudah terkunci tanpa persetujuan pemilik — buat entri baru yang men-supersede bila perlu.
>
> Terakhir diperbarui: 2026-07-03

| ID | Tgl | Keputusan | Alasan | Dampak / Terkait | Status |
|---|---|---|---|---|---|
| **D1** | 2026-07-03 | Ketersediaan/stok **tidak diotomatiskan** di MVP; customer ajukan booking → admin konfirmasi manual. Stok qty + ledger barang masuk/keluar + checklist gudang = **Phase 2**. | Belum ada data jumlah unit fisik; gap diisi subrental; jaga MVP tetap cepat rilis. | Data model disiapkan agar stok bisa nyambung nanti (DG4). | ✅ Terkunci |
| **D2** | 2026-07-03 | Katalog MVP mencakup semua lini (barang sewa, habis pakai, catering, kru). | Semua sudah bagian dari order existing. | Model produk harus dukung tipe heterogen (DG2). | ✅ Terkunci |
| **D3** | 2026-07-03 | **Sewa Lokasi ditunda ke Phase 2** (product type "location", struktur mirror item). | Rencana lokasi belum matang. | Data model dibuat extensible. | ✅ Terkunci |
| **D4** | 2026-07-03 | **Overtime** dicatat via **kategori denda** (Rp100k/jam barang, Rp50k/jam kru). | Overtime = tagihan setelah fakta pada order yang ada → cocok pola invoice `-D`. | Entity penalty punya kategori. | ✅ Terkunci |
| **D5** | 2026-07-03 | **Deposit/jaminan AKTIF di MVP.** | Sudah ada di sheet & bagian dari nilai bayar. | Field deposit% + deposit amount + grand total+deposit. | ✅ Terkunci |
| **D6** | 2026-07-03 | Default **Status Pembayaran = "Belum Lunas"** (koreksi dari default "Lunas" di sheet). | Cegah salah anggap sudah bayar. | Perubahan perilaku dari existing — disetujui pemilik. | ✅ Terkunci |
| **D7** | 2026-07-03 | Nomor order **tetap `DR-DDMMYY-NNNN`** dengan counter **global** (tidak reset). | Kontinuitas dengan kode yang sudah berjalan. | Backend pakai sequence/counter, format dipertahankan (KG3). | ✅ Terkunci |
| **D8** | 2026-07-03 | **Invoice otomatis ditunda ke Phase 2.** Backend = sumber kebenaran & menyajikan data order siap-invoice; selama dev invoice **ditarik/di-render manual**; **backend tidak menulis balik ke Sheets.** | Reuse aset invoice existing tidak masuk jalur kritis MVP; hindari dual source of truth. | Data model & API wajib menyimpan/menyajikan semua field invoice (header + item + total). | ✅ Terkunci |
| **D9** | 2026-07-03 | **Produk = satu tabel `products` + kolom `type`** (rental/expendable/catering/crew/location), bukan tabel terpisah per lini. (R1) | Skala kecil, sistem kode sudah seragam; hindari overengineering. | Perilaku harga dibedakan `type`/`pricing_basis`. | ✅ Terkunci |
| **D10** | 2026-07-03 | **Bundle = 1 baris `order_item`** (harga bundle) di MVP; pecah komponen ditunda ke Phase 2 (saat stok). (R4) | Sesuai perilaku sheet sekarang; komponen baru perlu saat tracking stok. | order_item punya `catalog_type` product/bundle. | ✅ Terkunci |
| **D11** | 2026-07-03 | **Customer = guest** (isi nama+telp, admin konfirmasi) di MVP; disimpan di tabel `customers` tanpa auth; staff di `users`. Akun/login = Future. (Q1, refine R2) | Paling simpel, cocok D1; alur konfirmasi manual. | Cek status customer = kode order + phone. | ✅ Terkunci |
| **D12** | 2026-07-03 | **`products.code` wajib, unik global, & tidak boleh direuse**; produk pensiun = **soft delete** (`is_active=false`). (Q5) | Kode dipakai tracking barang keluar; reuse kode = rusak jejak. | Tidak ada hard delete produk. | ✅ Terkunci |
| **D13** | 2026-07-03 | **Diskon hanya per-baris item** (bukan level order); persen atau nominal. (Q2, resolve O2) | Tidak semua item didiskon. | Field diskon ada di `order_items`. | ✅ Terkunci |
| **D14** | 2026-07-03 | **Satu denda per order** (kode `-D`); dihitung setelah periode maksimal selesai. (Q4, R6) | Denda final di akhir periode. | penalties 1:1 order. | ✅ Terkunci |
| **D15** | 2026-07-03 | **Pembatalan: disposisi DP fleksibel** — refund penuh / hangus / sebagian; admin tentukan; refund tercatat di ledger `payments`. (Q6, resolve O1) | Bisa jadi kesalahan pihak DuRent. | `orders.dp_disposition` + payment kind `refund`. | ✅ Terkunci |
| **D16** | 2026-07-03 | **Arsitektur:** modular monolith · layered (API→Service→Repository) · relational DB · **pricing engine** & **code generator** service khusus · integrasi via adapter · uang = integer rupiah · RBAC (customer-guest/gudang/admin/owner). | Skala kecil tapi harus rapi & scalable; hindari overengineering (microservices). | Semua modul mengikuti pola ini. **Tech stack vendor spesifik ditunda.** | ✅ Terkunci |
| **D17** | 2026-07-03 | **Efisiensi FE↔BE:** REST + list-ringkas/detail-agregat · `?include=` · cache katalog (ETag/Cache-Control) · pagination/filter server-side · gzip · eager-load anti-N+1 · `POST /orders/preview` untuk harga live. **GraphQL/tRPC ditolak** (overengineering). | Minim round-trip & over/under-fetch tanpa menambah kompleksitas. | API_CONTRACT §11; `GET /orders/{code}` jadi agregat. | ✅ Terkunci |
| **D18** | 2026-07-03 | **Model cutover migrasi = Opsi A (master-only + fresh start):** hanya master data dipindah; transaksi historis tetap arsip read-only di spreadsheet; order counter lanjut dari `MAX(NNNN)+1`. Migrasi historis = Phase 2 (opsional). | Volume historis kecil; MVP order lahir di backend; risiko rendah. | MIGRATION_PLAN.md. | ✅ Terkunci |
| **D19** | 2026-07-03 | **`POST /orders/preview` diambil untuk MVP** (harga live tanpa simpan); **`GET /dashboard/summary` ditunda ke Future** (bareng reporting). | Preview menjaga kalkulasi 1 sumber + UX booking; dashboard summary ikut penundaan reporting. | API_CONTRACT §5.0/§5; FRONTEND_PREPARATION §5. | ✅ Terkunci |
| **D20** | 2026-07-03 | **Tech stack: NestJS + Prisma (TypeScript) + PostgreSQL**; hosting free-tier (app: Render/Railway; DB: Neon/Supabase); Swagger (API docs), Jest (test), class-validator, @nestjs/throttler. | Modular by-design cocok arsitektur; TS manfaatkan familiaritas JS (Apps Script) + full-stack bila FE React/Next; gratis-dulu & scalable. | Semua modul/kode mengikuti. TECH_STACK.md; BACKEND_ARCHITECTURE §15. | ✅ Terkunci |
| **D21** | 2026-07-03 | **Konvensi scaffold (Tahap 0):** NestJS 11 + Prisma 7 (generator `prisma-client`, output `src/generated/prisma`, `moduleFormat=cjs`, driver adapter `@prisma/adapter-pg`, config via `prisma.config.ts`) · logger **nestjs-pino** (JSON; pino-pretty saat dev; redact header Authorization) · global prefix **`/api/v1`** · Swagger UI di **`/api/docs`** · ValidationPipe global (whitelist+transform, gagal = **422**) · exception filter global bentuk `{error:{code,message,details}}` dengan kode baku (VALIDATION_FAILED, NOT_FOUND, CONFLICT, dst.) · ThrottlerGuard global 60 req/menit (publik diperketat per-endpoint nanti) · koneksi DB **lazy** (DATABASE_URL placeholder sampai Tahap 1) · `postinstall: prisma generate`. | Prisma 7 tak lagi men-generate ke node_modules & butuh adapter; output di `src/` menjaga layout `dist/main.js`; sisanya implementasi langsung dari API_CONTRACT §1 + BACKEND_ARCHITECTURE §9–10. | Struktur `src/` per TECH_STACK §5; 8 modul domain kosong siap diisi Tahap 1–5; health check `GET /api/v1/health`. | ✅ Terkunci |

---

## Keputusan yang Masih Terbuka

| ID | Pertanyaan | Status | Diperlukan untuk |
|---|---|---|---|
| ~~O1~~ | Aturan pembatalan (DP) | ✅ Terjawab → **D15** | — |
| ~~O2~~ | Cara diskon diterapkan di website | ✅ Terjawab → **D13** (per-baris) | — |
| **O3** | Detail **sewa lokasi** (pengkodean, atribut) | ⏳ Terbuka | Phase 2 |
