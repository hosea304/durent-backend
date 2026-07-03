# BACKEND_ARCHITECTURE.md — Arsitektur Backend DuRent (Konsep)

> Rancangan arsitektur **konseptual** (Phase 4). Belum coding, belum memilih framework/DB vendor spesifik (lihat §15). Setiap bagian menjelaskan: **fungsi · kenapa · kaitan ke flow rental · risiko bila tidak ada · MVP/Future.**
>
> Basis: [`DATA_MODEL.md`](DATA_MODEL.md) · [`BUSINESS_FLOW.md`](BUSINESS_FLOW.md) · Terakhir diperbarui: 2026-07-03

---

## 1. Tanggung Jawab Backend

Backend adalah **satu-satunya sumber kebenaran** untuk data & aturan bisnis DuRent (menggantikan 2 spreadsheet + IMPORTRANGE). Tanggung jawabnya: menyimpan data, **menjalankan semua perhitungan** (durasi, total, diskon, deposit, denda), membuat kode order/denda, mengatur status & wewenang, dan menyajikan data siap-pakai untuk frontend + invoice.

- **Kenapa:** goal KG1/KG2 — konsistensi & hitungan terpusat.
- **Risiko bila tidak tegas:** logika bocor ke frontend/sheet → dua sumber kebenaran lagi.
- **MVP.**

---

## 2. Gaya Arsitektur: **Modular Monolith** (bukan microservices)

Satu aplikasi backend, dibagi jadi **modul domain** dengan batas jelas. **Bukan** microservices.

- **Kenapa:** skala 7–10 order/bulan; microservices = overengineering (langgar guardrail). Modular monolith memberi kerapian domain **tanpa** kompleksitas distribusi, dan tetap **bisa dipecah nanti** kalau perlu (SG1/SG2).
- **Kaitan flow:** tiap area bisnis (katalog, order, pembayaran, denda) jadi modul sendiri, mengikuti flow rental.
- **Risiko bila tidak:** kode "spaghetti" tanpa batas → sulit dirawat & di-scale.
- **MVP.**

---

## 3. Pemisahan Domain / Modul

| Modul | Tanggung jawab | Entity utama | MVP? |
|---|---|---|---|
| **Auth & Users** | Login staff, role, sesi/token | users | MVP |
| **Customers** | Data penyewa (guest) | customers | MVP |
| **Catalog** | Produk, bundling, sistem kode, harga, voucher | products, bundles, bundle_items, code_segments, vouchers | MVP |
| **Orders** | Buat/ubah order multi-item multi-tanggal, **pricing engine**, generate kode | orders, order_items | MVP |
| **Payments** | Ledger DP/pelunasan/refund, status bayar | payments | MVP |
| **Penalties** | Denda (kerusakan/kehilangan/overtime) | penalties, penalty_items | MVP |
| **Integrations** | WhatsApp (→ payment gateway, Drive nanti) | — | MVP (WA) |
| **Reporting** | Laporan/dashboard | (view) | Future |
| **Inventory** | Stok, barang masuk/keluar, availability | stock_ledger | **Phase 2** |

- **Risiko bila tidak dipisah:** perubahan di satu area merembet ke area lain.

---

## 4. Layering (dalam tiap modul)

```
API / Controller   → terima request, validasi bentuk, format response
      │
Service (domain)   → SEMUA aturan & perhitungan bisnis  ← inti
      │
Repository / Data  → akses DB (query, transaksi)
      │
Database           → penyimpanan
```

- **Kenapa:** controller tipis, logika terkumpul di service → mudah diuji & dirawat.
- **Risiko bila tidak:** logika tercecer di controller/DB → sulit divalidasi vs sheet.
- **MVP.**

### 4a. ⭐ Pricing / Calculation Engine (service khusus)
Satu tempat untuk **semua matematika uang**: `duration=(end-start)+1`, `amount=qty×unit_price`, `rental_total`, diskon (persen/nominal per-baris), `sub_total`, `grand_total`, `deposit_amount`, `total_with_deposit`, total denda.
- **Kenapa:** replikasi **persis** formula sheet (KG2); **wajib diuji paritas** vs spreadsheet (MG2).
- **Risiko bila tidak:** hasil beda dari sheet → tagihan salah, kepercayaan hilang.
- **MVP. Prioritas tinggi.**

### 4b. Code Generator (service khusus)
Membuat `orders.code` = `DR-DDMMYY-NNNN` via **sequence/counter** (bukan scan kolom), dan `penalties.code` = `order-D`. Menjamin **unik & tak reuse** (D12).
- **Risiko bila tidak:** tabrakan nomor (masalah yang persis dihindari komentar di AppScript existing).
- **MVP.**

---

## 5. Arah Desain Database

**Relational (SQL).** Data DuRent sangat relasional & finansial (order→item→payment→penalty dengan integritas & FK).

| Aspek | Arah |
|---|---|
| Tipe DB | Relational/SQL (vendor menyusul, §15) |
| Uang | Simpan **integer rupiah** (hindari float) |
| Integritas | Foreign key + constraint unik pada `code` |
| Snapshot | `unit_price` & total disalin saat order (R3) |
| Index | pada `orders.code`, `customers.phone`, `products.code`, tanggal item, `payments.order_id` |
| Soft delete | `is_active` (produk tak dihapus, kode tak reuse — D12) |
| Transaksi DB | Buat order + item + hitung total dalam **1 transaksi** (atomic) |

- **Risiko bila tidak relational:** integritas keuangan sulit dijamin.
- **MVP.**

---

## 6. Authentication

- **Staff (admin/gudang/owner):** login (email+password, hash **bcrypt/argon2**) → token (JWT) atau sesi.
- **Customer:** **guest** di MVP (D11) — tak login. Cek status order via **kode order + nomor telepon** (endpoint publik, di-rate-limit).
- **Kaitan flow:** customer booking tanpa hambatan; staff terlindungi.
- **Risiko bila tidak:** siapa saja bisa ubah order/status.
- **MVP** (akun customer = Future).

---

## 7. Authorization / Role (RBAC)

| Aksi | Guest/Customer | Gudang | Admin | Owner |
|---|:--:|:--:|:--:|:--:|
| Lihat katalog & harga | ✅ | ✅ | ✅ | ✅ |
| Buat booking | ✅ | – | ✅ | ✅ |
| Lihat status order sendiri (kode+telp) | ✅ | – | ✅ | ✅ |
| Konfirmasi/tolak order | – | – | ✅ | ✅ |
| Edit order, kelola katalog/voucher | – | – | ✅ | ✅ |
| Checklist barang keluar/masuk *(Phase 2)* | – | ✅ | ✅ | ✅ |
| Input denda | – | – | ✅ | ✅ |
| Input pelunasan / refund / disposisi DP | – | – | ✅ | ✅ |
| Override status | – | – | ✅ | ✅ |

> Fungsi *finance* saat ini digabung ke **admin** (pemilik setuju admin kelola pelunasan). Bisa jadi role terpisah nanti.
- **MVP.**

---

## 8. Validation

- **Lapis API:** bentuk/format (tipe, wajib, enum) via schema/DTO.
- **Lapis Service (aturan bisnis):** `end_date ≥ start_date`, `qty > 0`, catering `qty ≥ min_qty`, produk `is_active`, voucher valid, kode unik, hanya produk ada-kode yang bisa diorder (D12).
- **Risiko bila tidak:** data kotor masuk (persis "baris di-skip" di AppScript existing).
- **MVP.**

---

## 9. Error Handling

Bentuk error **konsisten** untuk frontend: `{ code, message, details[] }`.

| Situasi | Status |
|---|---|
| Validasi gagal | 422 |
| Tak berwenang / belum login | 401 / 403 |
| Tidak ditemukan | 404 |
| Konflik (kode duplikat) | 409 |
| Error server | 500 |

- **Kaitan:** FG1/FG2 — frontend butuh state error yang jelas.
- **MVP.**

---

## 10. Logging

- MVP: **structured logging** untuk request penting & semua error (siapa, kapan, apa).
- **Risiko bila tidak:** sulit menelusuri masalah produksi.
- **MVP (dasar).**

---

## 11. Audit Trail / Activity Log

Catat **mutasi kritis**: perubahan status order, edit order (seperti UpdatePesanan), input/refund pembayaran, disposisi DP, pembatalan, perubahan harga produk.
- **Kenapa:** pemilik butuh tahu "siapa ubah apa" (admin override & koreksi salah input adalah bagian nyata dari flow).
- **Risiko bila tidak:** sengketa data tak bisa dilacak.
- **MVP (versi ringkas untuk mutasi kritis)** · log penuh = Future.

---

## 12. Backup & Recovery

- **DB backup** otomatis (fitur free-tier managed DB) + kemampuan **export**.
- **Spreadsheet tetap jalan paralel** sebagai fallback selama transisi (MG3).
- **Risiko bila tidak:** kehilangan data transaksi = fatal.
- **MVP.**

---

## 13. Arsitektur Migrasi (spreadsheet → backend)

Modul/skrip **import** sekali-jalan yang bisa diulang (idempotent):
1. Baca sheet (CSV export atau Google Sheets API).
2. **Transform:** kelompokkan baris datar Database Penyewaan per Kode Transaksi → `orders` + `order_items`; abaikan baris buffer/kosong.
3. **Load** dengan **mempertahankan kode existing**; sequence lanjut dari `MAX(NNNN)+1`.
4. **Validasi paritas** total backend vs sheet sebelum cutover (MG2).
- Urutan: **master (produk/kode/voucher) → order → pembayaran**.
- Detail lengkap di `MIGRATION_PLAN.md` (Phase 8).
- **MVP (dibangun menjelang cutover).**

---

## 14. Kesiapan Frontend & Integrasi Eksternal

**Frontend (§16 spec):** REST API, JSON konsisten (tanggal ISO-8601, uang integer rupiah), pagination + filter, CORS, kontrak stabil terdokumentasi (`API_CONTRACT.md`, Phase 6). Melayani 3 permukaan: **customer booking**, **admin dashboard**, **gudang** (Phase 2).

**Integrasi eksternal — pola "adapter":** semua integrasi di balik **interface** agar mudah diganti.
| Integrasi | MVP | Cara |
|---|---|---|
| WhatsApp | ✅ | Order masuk → notifikasi/arahkan ke **admin WA** (klik-chat/`wa.me` atau WA API) |
| Payment gateway | Future | Slot di adapter yang sama, gantikan alur bayar manual |
| Google Drive (invoice) | Future | D8 — invoice ditunda |

- **Risiko bila tidak diabstraksi:** ganti WA→gateway butuh bongkar kode.

---

## 15. Tech Stack — **TERKUNCI (D20)**

**NestJS + Prisma (TypeScript) + PostgreSQL**, hosting managed free-tier (app: Render/Railway; DB: Neon/Supabase). NestJS dipilih karena **modular by-design** → memetakan 1:1 ke arsitektur di dokumen ini (Module=domain, Controller=API, Provider=Service, Prisma=Repository, Guard=RBAC, Pipe=validasi, Filter=error). Detail lengkap: [`TECH_STACK.md`](TECH_STACK.md).

---

## 16. Security · Scalability · Maintainability (ringkas)

| Aspek | Poin kunci | MVP? |
|---|---|---|
| **Security** | Hash password, validasi input, **rate-limit endpoint publik** (booking & cek status guest), secret via env var, HTTPS | MVP |
| **Scalability** | API **stateless** (bisa horizontal scale), index DB, modular → bisa dipecah; mulai 1 instance + DB free-tier, migrasi tanpa rewrite | MVP arah, skala nyata Future |
| **Maintainability** | Layering ketat, DTO, **unit test pricing engine**, penamaan konsisten, docs-first + DECISION_LOG | MVP |
| **Efisiensi API** (D17) | list-ringkas/detail-agregat, `?include=`, cache katalog (ETag), pagination server-side, gzip, **eager-load anti-N+1** | MVP |

---

## 17. Ringkasan Keputusan Arsitektur (untuk DECISION_LOG)

**D16:** Modular monolith · layered (API→Service→Repository) · relational DB · **pricing engine** & **code generator** sebagai service khusus · integrasi via adapter · uang = integer rupiah · RBAC (customer-guest/gudang/admin/owner). **Tech stack vendor spesifik ditunda** (§15).
