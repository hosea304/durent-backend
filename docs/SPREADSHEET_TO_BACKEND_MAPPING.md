# SPREADSHEET_TO_BACKEND_MAPPING.md — Mapping Existing → Backend

> **DRAFT (Phase 3).** Memetakan tiap sheet/kolom existing ke **calon** entity/field backend. **Belum final** — menunggu approval sebelum jadi schema. Pasangannya: [`DATA_MODEL.md`](DATA_MODEL.md).
>
> Terakhir diperbarui: 2026-07-03 · Basis: [`CURRENT_SPREADSHEET_STRUCTURE.md`](CURRENT_SPREADSHEET_STRUCTURE.md).

Legenda **Jenis**: `input` manual · `lookup` ambil dari sheet lain · `formula` hasil hitung · `generated` dibuat sistem.

---

## 1. Master Data Item → `code_segments` (reference)

Kamus 4-level untuk **menyusun kode produk**. Di backend jadi tabel referensi (atau seed/enum) yang dipakai service pembuat kode.

| Level existing | Contoh | → Field |
|---|---|---|
| Brand + Code | DuRent Support / `DS` | `code_segments(segment='brand', code, description)` |
| Universal Category + Code | Rental `RT`, Crew `CW`… | `segment='universal'` — sekaligus jadi **product.type** |
| Category Utama + Code | Catering `CT`, UPM… | `segment='category_utama'` |
| Sub Category + Code | Meja `MJ`, Kursi `KS`… | `segment='sub_category'` |

> Universal Category = **penentu tipe & perilaku produk** (rental/expendable/catering/crew/location). Ini kunci desain — lihat DATA_MODEL R1.

---

## 2. DuRent Items Code → `products`

| Kolom existing | Jenis | → `products` | Tipe | Catatan |
|---|---|---|---|---|
| Nama Barang | input | `name` | string | |
| Universal Category | input | `type` (rental/expendable/catering/crew/location) | enum | dari Universal Category |
| Category Utama | input | `category_utama_code` | string | |
| Sub Category | input | `sub_category_code` | string | |
| Brand/…/Sub **Code** (auto) | generated | (komponen `code`) | — | dipakai menyusun `code` |
| Code Number | generated | `code_number` | int | pembeda tipe sama beda merek (0001, 0002) |
| **Code** | generated | `code` **(unique)** | string | mis. `DS-RT-…-0001` |
| Category Universal | formula | `type` (turunan) | enum | konsisten dgn Universal Category |
| Harga | input | `base_price` | decimal(Rp) | harga acuan katalog |
| — | — | `pricing_basis` | enum | per_day_unit / per_unit / per_package / per_person_day (dari type) |
| — | — | `is_active` | bool | soft delete |
| — | — | `stock_qty` | int? | **Phase 2** (D1) |

---

## 3. DuRent Bundling + DuRent Bundling Code → `bundles` + `bundle_items`

**DuRent Bundling → `bundles`**

| Kolom | Jenis | → `bundles` | Catatan |
|---|---|---|---|
| Nama Bundling | input | `name` | |
| Universal Category / codes | input/auto | `type`, komponen `code` | |
| Code | generated | `code` (unique) | |
| — | — | `bundle_price` | **harga khusus manual** (D-terkait FG2) |
| — | — | `original_price` (derived) | Σ(komponen) untuk harga coret di FE |

**DuRent Bundling Code → `bundle_items`**

| Kolom | Jenis | → `bundle_items` | Catatan |
|---|---|---|---|
| Nama Bundling | input | (fk `bundle_id`) | |
| SKU Name | input | `product_id` / `sku_name` | tautkan ke `products` bila cocok |
| SKU Code | generated | `sku_code` | |
| Qty | input | `qty` | |
| Harga | input | `component_price` | untuk hitung `original_price` |

---

## 4. Database Penyewaan → `orders` (header) + `order_items` (baris)

**Split:** kolom yang **sama di semua baris satu Kode Transaksi** → `orders`; kolom **per barang** → `order_items`.

### 4a. Header → `orders`
| Kol | Kolom existing | Jenis | → `orders` | Catatan |
|---|---|---|---|---|
| A | Tanggal Invoice | generated | `invoice_date` | = tanggal order dibuat; **tak berubah saat update** |
| D | Kode Transaksi | generated | `code` (unique) | `DR-DDMMYY-NNNN` (D7) |
| E | Nama Penyewa | input | `customer_name` (snapshot) + fk `customer_id` | customer belum ada master → dibuat (R2) |
| F | No Telepon | input | `customer_phone` (snapshot) | |
| G | Alamat Shooting | input | `alamat_shooting` | **per-order**, bukan atribut customer |
| H | Purpose | input | `purpose` | |
| P | Kode Promo | input | `promo_code` → fk `vouchers` | 1 voucher per order |
| V | Deposit (%) | input | `deposit_percent` | D5 |
| Y | DP (50%) | input | `is_dp` | flag; tak ubah nilai |
| U | Grand Total | formula | `grand_total` (persisted) | Σ sub_total |
| W | Deposit Amount | formula | `deposit_amount` (persisted) | |
| X | Grand Total + Deposit | formula | `total_with_deposit` (persisted) | **rename** dari "Grand Total" yg ambigu |
| Z | Status Transaksi | lookup | `status_transaksi` | enum: pending/on_progress/completed/cancel |
| AA | Status Pembayaran | lookup | `status_pembayaran` | **default belum_lunas** (D6); diturunkan dari `payments` |

### 4b. Baris barang → `order_items`
| Kol | Kolom existing | Jenis | → `order_items` | Catatan |
|---|---|---|---|---|
| I | Nama Barang | input | `item_name` (snapshot) | |
| J | Kode Barang | lookup | `item_code` (snapshot) + fk `product_id`/`bundle_id` | |
| B | Tanggal Mulai | input | `start_date` | **per item** |
| C | Tanggal Selesai | input | `end_date` | **per item** |
| N | Durasi | formula | `duration` (derived) | `(end-start)+1` inklusif |
| L | Qty | input | `qty` | |
| K | Unit Price | lookup | `unit_price` (snapshot) | harga saat order (bukan live) |
| M | Amount | formula | `amount` | `qty × unit_price` |
| O | Rental Total | formula | `rental_total` | `duration × amount` |
| Q | Discount? | input | `is_discount` | |
| R | Discount % | lookup | `discount_percent` | dari voucher |
| S | Discount Amount | lookup | `discount_amount` | dari voucher |
| T | Sub Total | formula | `sub_total` | setelah diskon |
| — | *(baru)* | — | `delivery_slot` | catering: pagi/siang/sore (nullable) |
| — | *(baru, Phase 2)* | — | `picked_up_at`, `returned_at` | checklist gudang |

---

## 5. Database Denda → `penalties` + `penalty_items`

| Kolom existing | Jenis | → | Catatan |
|---|---|---|---|
| Tanggal Invoice Denda | generated | `penalties.invoice_date` | |
| Kode Transaksi Denda | generated | `penalties.code` | = order code + `-D` |
| Kode Transaksi | input | `penalties.order_id` (fk) | tautan ke order asli |
| Nama Penyewa | lookup | (dari order) | tak perlu disimpan ulang |
| Status Transaksi / Pembayaran | lookup | `penalties.status_*` | |
| Nama Barang | input | `penalty_items.product_name` | |
| Kode Barang | lookup | `penalty_items.product_code` | |
| Kategori Denda | input | `penalty_items.category` | enum: kerusakan/kehilangan/**overtime**(D4)/lainnya |
| Alasan Denda | input | `penalty_items.reason` | |
| Qty | input | `penalty_items.qty` | |
| Denda Per Quantity | input | `penalty_items.denda_per_qty` | |
| Denda Total Per Item | formula | `penalty_items.denda_total` | `qty × denda_per_qty` |
| Grand Total | formula | `penalties.grand_total` (derived) | Σ item |

---

## 6. Input Pelunasan / Status Pelunasan (file finance) → `payments`

| Kolom existing | Jenis | → `payments` | Catatan |
|---|---|---|---|
| Kode Transaksi | input | fk `order_id` | |
| Nama Penyewa | input | (dari order) | |
| Total Tagihan | formula | (derived) | order.total_with_deposit + Σ denda |
| Tanggal Bayar | input | `paid_date` | |
| Total Dibayar | input | `amount_paid` | **ledger**: 1 order bisa banyak baris (DP + pelunasan) — R5 |
| Status (Status Pelunasan) | formula | (derived) | `Σ amount_paid ≥ total_tagihan` → lunas |

---

## 7. Voucher Data & Settings → `vouchers`

| Kolom | → `vouchers` | Catatan |
|---|---|---|
| Kode Voucher | `code` (unique) | |
| Diskon Persen | `value` + `type='percent'` | |
| Diskon Rupiah | `value` + `type='nominal'` | voucher = persen **atau** nominal |

---

## 8. Ringkasan Klasifikasi

| Sumber | → Entity | Sifat |
|---|---|---|
| DuRent Items Code | `products` | Master |
| DuRent Bundling(+Code) | `bundles`, `bundle_items` | Master |
| Master Data Item | `code_segments` | Reference |
| Voucher Data & Settings | `vouchers` | Master |
| (baru) customer/staff | `users` | Master |
| Database Penyewaan | `orders`, `order_items` | Transaksi |
| Database Denda | `penalties`, `penalty_items` | Transaksi |
| Input Pelunasan | `payments` | Transaksi |
| — Phase 2 — | `stock_ledger`, `locations`, `activity_logs` | Future |
