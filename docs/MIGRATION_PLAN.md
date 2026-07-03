# MIGRATION_PLAN.md — Strategi Migrasi Spreadsheet → Backend

> Migrasi **bertahap, aman, bisa di-rollback.** Spreadsheet tetap jalan paralel sebagai fallback selama transisi (MG3). Basis: [`SPREADSHEET_TO_BACKEND_MAPPING.md`](SPREADSHEET_TO_BACKEND_MAPPING.md) · [`DATA_MODEL.md`](DATA_MODEL.md).
>
> Terakhir diperbarui: 2026-07-03 · Konsep.

---

## 0. Keputusan Kunci: Model Cutover (perlu konfirmasi → D18)

Karena **MVP = order lahir di backend** (customer self-booking) dan volume historis kecil (7–10/bln), saya rekomendasikan:

> **Opsi A (Rekomendasi): "Master-only + fresh start".**
> Migrasikan **hanya master data** (produk, bundling, voucher, kode). **Transaksi historis TIDAK dipindah** dulu — backend mulai order baru dari nol. Spreadsheet lama jadi **arsip read-only**. Satu-satunya yang wajib dibawa: **nomor urut order** (sequence lanjut dari `MAX(NNNN)+1`) agar kode baru tak tabrakan.

| | **Opsi A — Master-only (Rekomendasi)** | Opsi B — Migrasi penuh historis |
|---|---|---|
| Risiko | **Rendah** | Tinggi (grouping baris datar, cocokkan finance, paritas hitung) |
| Kecepatan MVP | Cepat | Lambat |
| Order lama | Tetap di spreadsheet (arsip) | Ikut pindah |
| Kapan | MVP | **Phase 2** bila laporan butuh histori |

Sisa dokumen ini mengasumsikan **Opsi A**. Bila Anda pilih B, tahap historis dinaikkan ke MVP.

---

## 1. Data yang Dimigrasikan Pertama (MVP)
**Master data** (fondasi katalog & booking):
1. `code_segments` (dari Master Data Item) — seed manual, kecil.
2. `products` (dari DuRent Items Code).
3. `bundles` + `bundle_items` (dari DuRent Bundling + Bundling Code).
4. `vouchers` (dari Voucher Data & Settings).
5. **Order counter** = `MAX(NNNN)` dari Database Penyewaan → sequence mulai +1.

## 2. Data yang Tetap di Spreadsheet Sementara
- **Database Penyewaan / Database Denda / Input Pelunasan historis** → arsip read-only (Opsi A).
- **Sistem invoice (PDF + Drive)** → tetap dipakai manual (D8) sampai Phase 2.
- **Stok fisik** → belum ada; onboarding di Phase 2 (D1).

## 3. Data yang Harus Dibersihkan Sebelum Migrasi
| Sumber | Pembersihan |
|---|---|
| products | pastikan **setiap barang punya kode unik** (D12); buang duplikat; lengkapi **harga**; tandai aktif/nonaktif |
| products (field baru) | isi `unit_label`, `min_qty` (catering), `pricing_basis`, `is_returnable` — belum ada di sheet |
| vouchers | pastikan jelas **persen ATAU nominal** |
| bundles | komponen menunjuk **kode produk valid**; `bundle_price` terisi |

## 4. Data: Auto-Import vs Mapping Manual
| Data | Cara |
|---|---|
| products, bundles, vouchers | **Auto** (CSV export / Google Sheets API) |
| code_segments | **Manual seed** (kecil, jarang berubah) |
| `type` produk | **Semi**: derive dari Universal Category (RT→rental, ED→expendable, FB/CT→catering, CW→crew) → **verifikasi manual** |
| `unit_label`/`min_qty`/`pricing_basis`/`is_returnable` | **Manual** (tak ada di sheet) |
| Order counter | **Auto** (scan MAX) |

## 5. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| **Duplikasi data** (import diulang) | Import **idempotent**: upsert by `code` (produk/bundle/voucher key = code) |
| **Kehilangan data** | **Backup/snapshot spreadsheet** sebelum mulai; import bersifat additive; spreadsheet tetap hidup |
| **Beda hasil hitung** backend vs sheet | **Uji paritas** Pricing Engine vs formula sheet (lihat §6) sebelum go-live |
| **Kode tabrakan** | Sequence mulai dari `MAX(NNNN)+1`; constraint unik di DB |
| Field baru kosong | Default aman + review pemilik sebelum publish katalog |

## 6. Strategi Validasi
1. **Paritas hitung (MG2):** ambil beberapa order historis dari sheet → masukkan input yang sama ke Pricing Engine → **total harus identik** (grand_total, deposit, sub_total per baris). Ini gate wajib.
2. **Count check:** jumlah produk aktif di backend == di sheet.
3. **Spot check pemilik:** cek beberapa produk/harga/bundle secara manual.
4. **Kode:** pastikan order baru pertama > kode historis tertinggi.

## 7. Strategi Rollback
- Opsi A bersifat **additive** → rollback = **tetap pakai spreadsheet** (masih hidup paralel). Tidak ada perubahan destruktif ke sheet.
- **Snapshot DB** sebelum tiap import; import idempotent → aman diulang.
- **Soft launch:** booking backend jalan paralel dengan alur WA lama beberapa waktu; kalau bermasalah, kembali ke input manual tanpa kehilangan apa pun.

## 8. Tahapan Migrasi MVP
| Tahap | Aksi | Gate |
|---|---|---|
| **0** | Backup + snapshot spreadsheet; export sheet master | backup terverifikasi |
| **1** | Seed `code_segments`; import `products` (+ isi field baru); QA | count & spot check |
| **2** | Import `bundles`+`bundle_items` + `vouchers`; QA | `original_price` benar |
| **3** | Set order counter; **uji paritas** Pricing Engine vs sheet | total identik |
| **4** | **Soft launch** booking customer (backend) paralel dgn WA | admin konfirmasi lancar |
| **5** | **Cutover**: order baru hanya di backend; input order sheet dipensiunkan; sheet = arsip read-only | pemilik setuju |

## 9. Tahapan Lanjutan (Phase 2+)
1. **Import historis** order/payment/penalty (bila laporan butuh) — grouping baris datar per Kode Transaksi, cocokkan finance, uji paritas.
2. **Onboarding stok**: hitung unit fisik → aktifkan availability & checklist gudang.
3. **Pensiunkan file finance**: pelunasan sepenuhnya di backend.
4. **Invoice native** (D8) + retire ketergantungan Sheets/Drive manual.
5. **Payment gateway** & akun customer.
