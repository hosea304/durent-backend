# DATA_MODEL.md — Data Model Backend (v1 — Konsep Final)

> ✅ **Semua keputusan model sudah dikonfirmasi pemilik** (R1–R6, Q1–Q6, D1–D15). Ini model **konseptual final** — tipe kolom, relasi, dan aturan. **Belum jadi migrasi/DDL** (itu dibuat saat fase build, setelah arsitektur Phase 4 disepakati).
>
> Pasangan: [`SPREADSHEET_TO_BACKEND_MAPPING.md`](SPREADSHEET_TO_BACKEND_MAPPING.md) · Keputusan: [`DECISION_LOG.md`](DECISION_LOG.md) · Terakhir diperbarui: 2026-07-14 (D25: kolom teknis `orders.code_number` & `order_items.line_no`)

---

## 1. Peta Entity

```
users (staff: admin/gudang/owner)          code_segments · vouchers   [reference/master]
customers (guest: nama+telp)
     │
     └─< orders >──< order_items >───┬── products        (catalog_type=product)
            │            │           └── bundles ──< bundle_items >── products
            │            └─ delivery_slot? · picked_up_at?/returned_at? (Phase 2)
            ├──< payments            (dp / pelunasan / refund)
            └──0..1 penalties ──< penalty_items
            (promo_code → vouchers)

Future (Phase 2): stock_ledger · locations · activity_logs
```
`<` one-to-many · `?` field disiapkan, logika Phase 2.

---

## 2. Keputusan Model (terkonfirmasi)

| ID | Keputusan | Ref |
|---|---|---|
| R1 | **Satu tabel `products`** + kolom `type` (rental/expendable/catering/crew/location) | D9 |
| R2 | Customer dinormalisasi; **guest → tabel `customers`** (tanpa auth), staff → `users`; alamat tetap di order | D11 |
| R3 | Total order & `unit_price` disimpan **snapshot** | — |
| R4 | Bundle = **1 baris `order_item`** (harga bundle); pecah komponen = Phase 2 | D10 |
| R5 | `payments` = **ledger** (dp → pelunasan → refund) | — |
| R6 | **1 `penalty` per order** (kode `-D`), banyak item; dihitung setelah periode maksimal | D14 |
| Q2 | Diskon **hanya per-baris**, tidak ada level order; persen atau nominal | D13 |
| Q5 | Setiap produk **wajib kode unik & permanen**; produk pensiun = **soft delete** (kode tak boleh direuse) | D12 |
| Q6 | Pembatalan: **disposisi DP fleksibel** (refund penuh / hangus / sebagian), admin tentukan | D15 |

---

## 3. Entity MVP

### 3.1 `users` (staff)
| Field | Tipe | Catatan |
|---|---|---|
| id | uuid | PK |
| name | string | |
| email | string(unique) | login |
| phone | string? | |
| password_hash | string | |
| role | enum | admin / gudang / owner |
| is_active | bool | |
| created_at, updated_at | timestamp | |

### 3.2 `customers` (guest)
| Field | Tipe | Catatan |
|---|---|---|
| id | uuid | PK |
| name | string | = Nama Penyewa |
| phone | string | = No Telepon; kandidat dedup |
| created_at | timestamp | |
> Tanpa password. Cek status order oleh customer = **kode order + phone**. Akun/login = Future.

### 3.3 `products`
| Field | Tipe | Catatan |
|---|---|---|
| id | uuid | PK |
| code | string(unique, **immutable**) | `DS-RT-…-0001`; **tak boleh direuse** (Q5/D12) |
| name | string | |
| type | enum | rental / expendable / catering / crew / location |
| category_utama_code, sub_category_code | string | dari sistem kode |
| code_number | int | pembeda tipe sama beda merek |
| base_price | decimal | |
| pricing_basis | enum | per_day_unit / per_unit / per_package / per_person_day |
| unit_label | string | unit / pax / orang |
| min_qty | int? | catering (mis. 20) |
| is_returnable | bool | rental=true |
| is_active | bool | **soft delete** (kode tetap terpakai) |
| stock_qty | int? | **Phase 2 (D1)** |

### 3.4 `bundles` / `bundle_items`
**bundles:** id · code(unique) · name · type · **category_utama_code** · **code_number** · **bundle_price** (manual) · is_active · timestamps · *(derived)* `original_price` = Σ(qty × component_price) untuk harga coret FE.
**bundle_items:** id · bundle_id(fk) · product_id(fk?) · sku_name · sku_code · qty · component_price (snapshot `base_price` produk komponen).
> **Format kode bundle (dari sheet DuRent Bundling, D22):** `DS-BI-{CAT_UTAMA}-{NNNN}` — segmen universal konstan `BI` ("Bundling Items"), nomor urut per category utama. `category_utama_code` + `code_number` disimpan agar nomor berikutnya dihitung dari data, bukan parsing string kode. Kolom *Harga* di sheet DuRent Bundling Code = **harga bundle** (bukan harga komponen).

### 3.5 `orders`
| Field | Tipe | Catatan |
|---|---|---|
| id | uuid | PK |
| code | string(unique) | `DR-DDMMYY-NNNN`, counter global (D7) |
| code_number | int(unique) | *(teknis, D25)* NNNN global — MAX+1 tanpa parsing string (pola bundle D22) |
| invoice_date | date | tanggal dibuat (zona WIB, D25); **tetap saat update** |
| customer_id | fk customers | + snapshot `customer_name`, `customer_phone` |
| alamat_shooting | string | per-order |
| purpose | string | |
| promo_code | fk vouchers? | 1 voucher/order |
| is_dp | bool | flag DP 50% |
| deposit_percent | decimal | D5 |
| grand_total | decimal | Σ sub_total (snapshot) |
| deposit_amount | decimal | snapshot |
| total_with_deposit | decimal | snapshot |
| status_transaksi | enum | pending / on_progress / completed / cancel |
| status_pembayaran | enum | belum_lunas / sebagian / lunas — **default belum_lunas** (D6); derived (label: FRONTEND_PREPARATION §4) |
| confirmed_at, confirmed_by | timestamp?, fk users? | admin konfirmasi ketersediaan (D1/D11); null = belum dikonfirmasi |
| cancelled_at | timestamp? | |
| dp_disposition | enum? | refund_full / forfeit / partial / none (D15) |
| created_at, updated_at | timestamp | |

### 3.6 `order_items`
| Field | Tipe | Catatan |
|---|---|---|
| id | uuid | PK |
| order_id | fk | |
| line_no | int | *(teknis, D25)* urutan baris invoice stabil (D8); unik per order |
| catalog_type | enum | product / bundle |
| product_id / bundle_id | fk? | salah satu |
| item_name, item_code | string(snapshot) | |
| start_date, end_date | date | **per item** |
| duration | int | `(end-start)+1` |
| qty | int | |
| unit_price | decimal(snapshot) | |
| amount | decimal | qty × unit_price |
| rental_total | decimal | duration × amount |
| is_discount | bool | |
| discount_percent / discount_amount | decimal? | dari voucher (per-baris, Q2) |
| sub_total | decimal | setelah diskon |
| delivery_slot | enum? | catering: pagi/siang/sore |
| picked_up_at, returned_at | timestamp? | **Phase 2** checklist gudang |

### 3.7 `payments` (ledger)
| Field | Tipe | Catatan |
|---|---|---|
| id | uuid | PK |
| order_id | fk | |
| kind | enum | dp / pelunasan / refund |
| amount | decimal | refund bernilai negatif/terpisah |
| paid_date | date | |
| note | string? | |
> `total_tagihan` = `orders.total_with_deposit` + Σ `penalties.grand_total`. Lunas bila Σ(dp+pelunasan) − Σ refund ≥ total_tagihan.

### 3.8 `penalties` / `penalty_items`
**penalties:** id · code(= order+`-D`) · order_id(fk) · invoice_date · grand_total(derived) · status_transaksi · status_pembayaran · timestamps. **1 per order** (D14).
**penalty_items:** id · penalty_id(fk) · product_name · product_code · **category** enum(kerusakan/kehilangan/overtime/lainnya — D4) · reason · qty · denda_per_qty · denda_total.

### 3.9 Reference
- **code_segments:** segment_type(brand/universal/category_utama/sub) · code · description · is_active.
- **vouchers:** code(unique) · type(percent/nominal) · value · is_active.

---

## 4. Entity Future (Phase 2 — disiapkan, belum dibangun)
- **stock_ledger** + `products.stock_qty` → barang masuk/keluar, availability (D1).
- **locations** → sewa lokasi (D3) sebagai product type `location` + atribut.
- **activity_logs** → audit trail.

---

## 5. Aturan Bisnis yang Melekat di Model
1. `products.code` & `orders.code` **unik & tidak pernah direuse**; hapus = soft delete.
2. Semua **perhitungan di server**, direplikasi persis dari formula sheet (durasi +1 inklusif; diskon persen/nominal per-baris; deposit atas dasar pra-diskon). Wajib validasi paritas vs sheet (MG2).
3. Nilai harga & total **di-snapshot** saat order — perubahan harga master tidak mengubah histori.
4. Status transaksi default `pending`; `on_progress`/`completed` dari checklist gudang (Phase 2), admin boleh override.
5. Status pembayaran default `belum_lunas`, diturunkan dari ledger `payments`.
6. Pembatalan → set `cancel` + `dp_disposition`; refund tercatat sebagai baris `payments`.

---

## 6. Semua Pertanyaan Data Model → TERJAWAB
O1 (pembatalan)→D15 · O2 (diskon)→D13 (per-baris) · Q1→guest · Q2→per-baris · Q4→1 denda/order · Q5→kode unik+soft delete · Q6→DP fleksibel. **Sisa terbuka:** O3 (detail sewa lokasi) = Phase 2.

> ✅ Data model konsep siap. Langkah berikut: **Phase 4 — Backend Architecture** (baru setelah itu schema/migrasi ditulis).
