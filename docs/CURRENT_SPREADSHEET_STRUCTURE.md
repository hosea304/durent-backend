# CURRENT_SPREADSHEET_STRUCTURE.md — Struktur Data Existing

> Dokumentasi **struktur data spreadsheet apa adanya (as-is)**. Menjadi basis untuk `SPREADSHEET_TO_BACKEND_MAPPING.md` (Phase 3). **Baca sebelum menyentuh apa pun terkait data/schema.**
>
> Terakhir diperbarui: 2026-07-03 · Sumber: struktur kolom + source code Apps Script + screenshot Master Data Item.

---

## 1. Gambaran: 2 File Spreadsheet

| File | Isi |
|---|---|
| **File Operasional** | Input pesanan/denda/update, input status, Database Penyewaan, Database Denda, sheet inventory & sistem kode |
| **File Finance** | Input Pelunasan, Status Pelunasan |

Penghubung antar-file: `IMPORTRANGE` + `XLOOKUP`/`ARRAYFORMULA`.

---

## 2. Daftar Sheet & Fungsi

| Sheet | Fungsi | Jenis |
|---|---|---|
| Dashboard Input Pesanan | Form input order → panggil Apps Script `simpanDataInvoice()` | Input |
| Dashboard Input Denda | Form input denda → `simpanDataDenda()` | Input |
| Dashboard Update Pesanan | Edit order existing → `loadDataUntukUpdate()` / `updateDataInvoice()` | Input |
| Input Status Transaksi | Sumber Status Transaksi | Input |
| Input Status Denda | Sumber Status Denda | Input |
| **Database Penyewaan** | Pusat semua data transaksi (order lines) | **Transaksi** |
| **Database Denda** | Pusat semua data denda | **Transaksi** |
| Master Data Item | Kamus deskripsi → kode (4 level) | Master |
| Master Data Bundling | Kamus untuk bundling | Master |
| DuRent Items Code | Rakit kode barang + harga | Master |
| DuRent Bundling | Rakit kode bundling | Master |
| DuRent Bundling Code | Breakdown komponen bundling | Master |
| Input Pelunasan *(file finance)* | Input pembayaran per order | Transaksi |
| Status Pelunasan *(file finance)* | Monitoring lunas/belum | Calculated |

---

## 3. Sistem Kode Produk

**Hierarki 4 level (Master Data Item):** kode = gabungan level + nomor urut.

```
DS      -  RT/ED/FB/CW/LC        -  CM/CT/UPM/…            -  HT/KS/TD/…        - 0001
Brand      Universal Category       Category Utama            Sub Category         No. urut
(DuRent    (Rental/Expendable/      (Communication/           (Barang)             (tipe sama,
 Support)   Food&Bev/Crew/Location)  Catering/UPM/…)                                beda merek)
```

**Universal Category:** Rental `RT`, Expendable `ED`, Food & Beverage `FB`, Crew `CW`, Location `LC`.
**Category Utama (contoh):** Communication `CM`, Medic `MD`, Electrical `ET`, Power `PW`, Safety `SF`, Others `OT`, Expandables `EP`, Transport `TP`, Snack & Beverage `SB`, Catering `CT`, Unit Production Manager `UPM`, Runner `RN`, Production Unit `PU`, Addon `AO`.
**Sub Category / Barang (contoh):** Handy Talky `HT`, Solidcom `SC`, Snacks `SN`, Beverages `BV`, Paket Catering `PC`, P3K `PP`, Meja `MJ`, Kursi `KS`, Tenda `TD`, Table Cover `TC`, Lampu `LP`, Kipas Angin `KA`, Cooler Box `CB`, Water Boiler `WB`, Water Tank Jug `WJ`, Termos `TP`.

> Nomor urut memisahkan barang **tipe sama beda merek** (0001, 0002). **Harga** diinput per barang di DuRent Items Code.

---

## 4. Struktur Kolom Sheet Inti

### 4.1 Database Penyewaan (27 kolom, tabel datar)
Header order diulang tiap baris item. Kolom **A–Y** ditulis Apps Script; **Z, AA** formula.

| Kol | Kolom | Sumber | Kol | Kolom | Sumber |
|---|---|---|---|---|---|
| A | Tanggal Invoice | generated | O | Rental Total | calc |
| B | Tanggal Mulai | input | P | Kode Promo | input |
| C | Tanggal Selesai | input | Q | Discount? | input (bool) |
| D | **Kode Transaksi** | generated | R | Discount % | lookup |
| E | Nama Penyewa | input | S | Discount Amount | lookup |
| F | No Telepon | input | T | Sub Total | calc |
| G | Alamat Shooting | input | U | Grand Total | calc |
| H | Purpose | input | V | Deposit (%) | input |
| I | Nama Barang | input | W | Deposit Amount | calc |
| J | Kode Barang | lookup | X | Grand Total + Deposit | calc |
| K | Unit Price | lookup | Y | DP (50%) | input (bool) |
| L | Qty | input | Z | Status Transaksi | ← Input Status Transaksi |
| M | Amount | calc | AA | Status Pembayaran | ← Pelunasan (import) |
| N | Durasi | calc | | | |

### 4.2 Database Denda (14 kolom)
`Tanggal Invoice Denda · Kode Transaksi Denda (=order+"-D") · Kode Transaksi · Nama Barang · Kode Barang · Kategori Denda · Alasan Denda · Qty · Denda Per Quantity (Rp) · Denda Total Per Item · Grand Total · Nama Penyewa · Status Transaksi · Status Pembayaran`
Kolom A–K ditulis script; sisanya lookup.

### 4.3 DuRent Items Code
`Nama Barang (input) · Brand Code (auto) · Universal Category (input) · [Universal] Code (auto) · Category Utama (input) · Category Utama Code (auto) · Sub Category (input) · Sub Category Code (auto) · Code Base (auto) · Code Number (auto) · Code (auto) · Category Universal (auto) · Harga (input)`

### 4.4 DuRent Bundling
`Nama Bundling (input) · Brand Code (auto) · Universal Category (input) · [Universal] Code (auto) · Category Utama (input) · Category Utama Code (auto) · Code Base (auto) · Code Number (auto) · Code (auto) · Category Universal (auto)`

### 4.5 DuRent Bundling Code (komponen bundling)
`Nama Bundling (input) · SKU Bundling (auto) · SKU Name (input) · SKU Code (auto) · Qty (input) · Category Universal (auto) · Harga (input)`

### 4.6 Input Pelunasan *(file finance)*
`Kode Transaksi · Nama Penyewa · Total Tagihan · Tanggal Bayar · Total Dibayar`

### 4.7 Status Pelunasan *(file finance)*
`List Transaksi + Denda · Nama Penyewa · Total Tagihan · Total Dibayar · Status · Status Pemesanan`

---

## 5. Formula / Perhitungan Kunci

| Besaran | Logika |
|---|---|
| Durasi | `(Selesai − Mulai) + 1` (inklusif; invalid bila negatif) |
| Amount | `Qty × Unit Price` |
| Rental Total | `Durasi × Amount` |
| Discount % / Amount | `XLOOKUP(kodePromo, Voucher Data & Settings)` → persen (kol C) atau nominal (kol D) |
| Sub Total | persen → `Rental − (Rental × %)`; nominal → `Rental − nominal` |
| Grand Total | `SUM(Sub Total)` |
| Deposit Amount | `SUM(Rental Total) × Deposit%` |
| Grand Total + Deposit | `Grand Total + Deposit Amount` |
| Unit Price | `XLOOKUP(kodeBarang, '[Import] Product Data & Settings')` |
| Status Pembayaran | `XLOOKUP(kodeTransaksi, '[Import] Pelunasan', default "Lunas")` ⚠️ |

---

## 6. Ringkasan Apps Script

| Fungsi | File | Aksi |
|---|---|---|
| `simpanDataInvoice()` | InputPesanan.gs | Baca form → validasi → **generate Kode Transaksi `DR-DDMMYY-NNNN`** (max global +1) → batch tulis A–Y ke Database Penyewaan |
| `simpanDataDenda()` | InputDenda.gs | Baca form → generate `KodeOrder-D` → batch tulis A–K ke Database Denda |
| `loadDataUntukUpdate()` / `updateDataInvoice()` | UpdatePesanan.gs | Load order by kode → edit → overwrite in-place (3 skenario: sama/berkurang/bertambah), **Tanggal Invoice dipertahankan** |

**Format nomor order:** `DR` + tanggal input `DDMMYY` + nomor urut **global** 4 digit (tidak reset). Denda = kode order + `-D`.

---

## 7. Risiko & Isu Data

| # | Isu | Dampak | Rencana backend |
|---|---|---|---|
| 1 | Default Status Pembayaran = **"Lunas"** bila tak ditemukan di Pelunasan | Order belum bayar bisa dianggap lunas | Default **"Belum Lunas"** (D6) |
| 2 | Generator nomor order = **scan kolom D global** + baris buffer + akal-akalan spill ARRAYFORMULA | Rapuh, rawan salah baris | Ganti dengan **sequence/counter** DB |
| 3 | Tabel **datar/denormalisasi** (header order diulang tiap baris) | Redundansi, rawan inkonsistensi | Normalisasi → **orders + order_items** |
| 4 | Istilah **"Grand Total" bertumpuk** (setelah diskon vs +deposit) | Ambigu | Penamaan field diperjelas |
| 5 | **Deposit (jaminan) ≠ DP (50%)** sering tertukar | Salah paham nilai bayar | Field terpisah & jelas |
| 6 | **Belum ada stok/ketersediaan** | Tak bisa cek avail otomatis | Manual di MVP (D1); stok di Phase 2 |
| 7 | **Slot waktu catering & 1-kru-1-job** belum termodel | Info hilang di sheet | Diangkat di Phase 3 |

---

## 8. Klasifikasi Data (untuk mapping Phase 3)

| Kategori | Contoh |
|---|---|
| **Master data** | Master Data Item, DuRent Items Code (barang + harga), Bundling |
| **Transaksi** | Database Penyewaan, Database Denda, Input Pelunasan |
| **Calculated** | Durasi, Amount, Rental/Sub/Grand Total, Deposit, Status Pembayaran |
| **Generated** | Kode Transaksi, Kode Denda, Tanggal Invoice, kode produk |
| **Manual input** | Customer info, tanggal, qty, kategori/alasan denda, total dibayar |
