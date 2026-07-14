# API_CONTRACT.md — Kontrak API DuRent (Konsep, stack-agnostic)

> Rancangan endpoint **mengikuti flow rental**, bukan CRUD telanjang. Belum terikat framework. Basis: [`DATA_MODEL.md`](DATA_MODEL.md) · [`BUSINESS_FLOW.md`](BUSINESS_FLOW.md) · [`BACKEND_ARCHITECTURE.md`](BACKEND_ARCHITECTURE.md).
>
> Terakhir diperbarui: 2026-07-14 · §3 (Auth) ✅ Tahap 2 · §4 (Catalog) ✅ Tahap 1 · §5 (Orders) ✅ Tahap 3 (D25) · **§6 (Payments) ✅ Tahap 4 (D26)** — §7–8 menyusul Tahap 5–6.

---

## 1. Konvensi

| Hal | Aturan |
|---|---|
| Base URL | `/api/v1` |
| Format | JSON; tanggal **ISO-8601** (`2026-07-10`); uang **integer rupiah** (mis. `150000`) |
| Auth | Staff: header `Authorization: Bearer <token>`. Customer: **guest** (tanpa token) |
| Sukses | `{ "data": ..., "meta": {...}? }` |
| Error | `{ "error": { "code", "message", "details": [] } }` — status 401/403/404/409/422/500 |
| List | `?page=&limit=&sort=` + filter spesifik; `meta` berisi total & paging |
| Rate limit | endpoint publik (booking, cek status) dibatasi |

Peran: 🟢 publik/guest · 🔵 admin · 🟠 gudang · 🟣 owner.

---

## 2. Ikhtisar Grup Endpoint

| Grup | Untuk flow | Peran | MVP? |
|---|---|---|---|
| Auth | login staff | 🔵🟠🟣 | MVP |
| Catalog | halaman katalog customer + kelola produk | 🟢 baca / 🔵 kelola | MVP |
| Orders | buat & kelola order rental | 🟢 buat / 🔵 kelola | MVP |
| Payments | DP, pelunasan, refund | 🔵 | MVP |
| Penalties | denda | 🔵 | MVP |
| Invoice | data siap-invoice (tanpa PDF, D8) | 🔵 | MVP |
| Integrations | WhatsApp | sistem | MVP |
| Inventory | stok & availability | 🟠🔵 | **Phase 2** |
| Reporting | dashboard/laporan | 🔵🟣 | **Future** |

---

## 3. Auth
| Method · Path | Peran | Fungsi |
|---|---|---|
| `POST /auth/login` | 🔵🟠🟣 | login staff → token; body `{email, password}` |
| `POST /auth/logout` | staff | akhiri sesi |
| `GET /auth/me` | staff | profil + role (frontend atur menu) |

---

## 4. Catalog

### Publik (halaman customer)
| Method · Path | Fungsi | Return |
|---|---|---|
| `GET /products` | katalog; filter `?type=&q=&page=` (hanya `is_active`) | list: code, name, type, base_price, unit_label, min_qty |
| `GET /products/{code}` | detail 1 produk | detail produk |
| `GET /bundles` | daftar bundling | code, name, **bundle_price**, **original_price** (harga coret FG2) |
| `GET /bundles/{code}` | detail bundling + komponen | + `items[]` (nama, qty) |

### Kelola (admin)
| Method · Path | Fungsi | Catatan |
|---|---|---|
| `POST /products` 🔵 | buat produk | server susun `code` dari segmen; validasi kode unik (D12) |
| `PATCH /products/{id}` 🔵 | ubah produk | `code` **immutable** |
| `DELETE /products/{id}` 🔵 | pensiun produk | **soft delete** (`is_active=false`) |
| `POST /products/preview-code` 🔵 | pratinjau kode dari segmen dipilih | bantu UI pembuatan kode |
| `GET /code-segments` 🔵 | daftar segmen (brand/universal/…) | untuk form kode |
| `POST/PATCH/DELETE /bundles` 🔵 | kelola bundling + komponen | |
| `GET/POST/PATCH /vouchers` 🔵 | kelola voucher | type percent/nominal |

---

## 5. Orders — inti flow rental

### 5.0 Preview harga (guest) — MVP
`POST /orders/preview` 🟢 — dipakai di **halaman booking** untuk **harga live** saat customer menyusun pesanan. Body **sama persis** dengan `POST /orders`, tetapi server **hanya menghitung** (Pricing Engine) lalu balas ringkasan harga — **tanpa menyimpan, tanpa terbit kode/order**. Menjaga kalkulasi tetap satu sumber (KG2/D17).
```jsonc
// Response 200 — hanya angka
{ "data": {
  "items": [ { "item_name":"Kursi","duration":2,"qty":20,"unit_price":5000,
               "rental_total":200000,"sub_total":200000 }, ... ],
  "grand_total": 900000, "deposit_amount": 450000, "total_with_deposit": 1350000
} }
```

### 5.1 Buat booking (guest) — ⭐
`POST /orders` 🟢 — dipakai di **halaman booking customer**.
```jsonc
// Request
{
  "customer": { "name": "Budi", "phone": "0812..." },
  "alamat_shooting": "Studio X, Jakarta",
  "purpose": "Shooting FTV",
  "promo_code": "BUNDLE5",          // opsional
  "is_dp": true,                     // opsional (flag DP 50%)
  "deposit_percent": 50,             // opsional (D5)
  "items": [
    { "catalog_type": "product", "code": "DS-RT-…-KS-0001",
      "start_date": "2026-07-10", "end_date": "2026-07-11",
      "qty": 20, "is_discount": false, "delivery_slot": null },
    { "catalog_type": "product", "code": "DS-FB-CT-PC-0001",
      "start_date": "2026-07-10", "end_date": "2026-07-10",
      "qty": 60, "delivery_slot": "pagi" },        // catering
    { "catalog_type": "bundle", "code": "DS-RT-…-BND-0001",
      "start_date": "2026-07-10", "end_date": "2026-07-12", "qty": 1 }
  ]
}
```
**Server melakukan:** ambil harga dari katalog (**snapshot**), hitung durasi/amount/rental_total/diskon/sub_total/grand_total/deposit (**Pricing Engine**), generate `code` (**Code Generator**), set `status_transaksi=pending`, `status_pembayaran=belum_lunas`, `confirmed_at=null`.
```jsonc
// Response 201 — order lengkap (siap-invoice)
{ "data": {
  "code": "DR-030726-0007", "invoice_date": "2026-07-03",
  "customer": {...}, "alamat_shooting": "...", "purpose": "...",
  "items": [ { "item_name":"Kursi","item_code":"…","start_date":"…","end_date":"…",
               "duration":2,"qty":20,"unit_price":5000,"amount":100000,
               "rental_total":200000,"is_discount":false,"sub_total":200000,
               "delivery_slot":null }, ...],
  "grand_total": 900000, "deposit_percent": 50, "deposit_amount": 450000,
  "total_with_deposit": 1350000, "is_dp": true,
  "status_transaksi": "pending", "status_pembayaran": "belum_lunas",
  "whatsapp_admin_url": "https://wa.me/…?text=Order%20DR-030726-0007"
} }
```
**Validasi:** `end_date ≥ start_date`; `qty > 0`; catering `qty ≥ min_qty`; produk `is_active` & ada kode (D12); voucher valid; `catalog_type` cocok id/code. **Risiko validasi:** tanggal terbalik, qty nol, produk nonaktif, kode voucher salah.

### 5.2 Kelola order (admin)
| Method · Path | Peran | Fungsi | Catatan |
|---|---|---|---|
| `GET /orders` | 🔵 | list + filter `?status=&payment=&q=&from=&to=` | dashboard admin |
| `GET /orders/{code}` | 🔵 | detail **agregat** (items + billing + payments + penalties) — **1 panggilan** | siap-invoice; lihat §11 |
| `GET /orders/lookup?code=&phone=` | 🟢 | **cek status** oleh customer (guest) | rate-limited; return ringkas |
| `PATCH /orders/{code}` | 🔵 | edit order (mirip *UpdatePesanan*) | recompute total; **`code` & `invoice_date` tetap**; `items` dikirim = ganti seluruh baris (D25 ⑦) |
| `POST /orders/{code}/confirm` | 🔵 | **konfirmasi ketersediaan** (D1) | set `confirmed_at`+`confirmed_by`; idempoten (lihat §9) |
| `POST /orders/{code}/status` | 🔵🟠 | ubah `status_transaksi` (on_progress/completed) | admin boleh **override**; order cancel → 409 |
| `POST /orders/{code}/cancel` | 🔵 | batalkan + `dp_disposition` (refund_full/forfeit/partial/none) | baris refund dicatat via `POST /payments` (Tahap 4, D15) |

> **Catatan implementasi Tahap 3 (D25):** `GET /orders/{code}` sudah membalas bentuk agregat lengkap — `billing` (total_tagihan/total_paid/outstanding) dihitung; `payments[]` & `penalties[]` masih kosong sampai Tahap 4–5. Lookup guest menormalkan telepon (08… ≡ 628…) dan membalas 404 tunggal (privasi). Throttle publik: booking 5×/menit · lookup 10×/menit · preview 30×/menit.

---

## 6. Payments (ledger)
| Method · Path | Peran | Fungsi |
|---|---|---|
| `GET /orders/{code}/billing` | 🔵 | ringkas tagihan: `total_tagihan` (order+denda), `total_paid`, `outstanding`, `status_pembayaran` |
| `GET /orders/{code}/payments` | 🔵 | daftar ledger |
| `POST /orders/{code}/payments` | 🔵 | tambah pembayaran `{ kind: dp\|pelunasan\|refund, amount, paid_date, note? }` → recompute status |

> Lunas bila `Σ(dp+pelunasan) − Σ refund ≥ total_tagihan`. Default **belum_lunas** (D6); di antaranya `sebagian`.
> **Catatan implementasi Tahap 4 (D26):** semua amount ledger positif (refund dikurangkan saat derivasi); order cancel hanya menerima refund (409 untuk dp/pelunasan); respons `POST /payments` = `{payment, billing}`; status di-recompute juga saat `PATCH /orders/{code}`.

---

## 7. Penalties (denda)
| Method · Path | Peran | Fungsi |
|---|---|---|
| `POST /orders/{code}/penalties` | 🔵 | buat denda `-D` (1 per order, D14); body `items[]: {product_name, product_code, category(kerusakan\|kehilangan\|overtime\|lainnya), reason, qty, denda_per_qty}` |
| `GET /orders/{code}/penalties` | 🔵 | denda milik order |
| `GET /penalties/{code}` | 🔵 | detail denda (`…-D`) |

> Server generate kode `-D`, hitung `denda_total = qty × denda_per_qty` & grand_total. Overtime = kategori (D4).

---

## 8. Invoice & Integrations
| Method · Path | Peran | Fungsi |
|---|---|---|
| `GET /orders/{code}/invoice` | 🔵 | **payload siap-invoice** (header+items+totals+deposit+denda+ringkas bayar). **Tanpa PDF** (D8) — Anda render manual |
| *(sistem)* WhatsApp | — | saat `POST /orders`, backend siapkan **notifikasi/URL ke admin WA** (via adapter integrasi) |

---

## 9. Penyesuaian Data Model (perlu dicatat)
Flow **guest → admin konfirmasi** (D1/D11) butuh konsep "sudah dikonfirmasi" tanpa menambah nilai status. **Usul:** tambah `orders.confirmed_at` (+ `confirmed_by`). Order baru `pending` **belum** dikonfirmasi; `POST /confirm` mengisinya. Ini penambahan kecil, **transparan** — akan ditambahkan ke `DATA_MODEL.md` bila Anda setuju.

---

## 10. Hubungan Antar Endpoint (alur)
```
Katalog (GET /products,/bundles)
   → Booking (POST /orders)  ──→ WhatsApp ke admin
        → Admin: GET /orders → POST /orders/{code}/confirm
             → (opsional) PATCH /orders/{code}
             → POST /orders/{code}/payments (DP → pelunasan)
             → POST /orders/{code}/status (on_progress → completed)
             → (jika ada) POST /orders/{code}/penalties  → payments lagi
             → (batal) POST /orders/{code}/cancel (+ dp_disposition → refund)
   Customer: GET /orders/lookup (pantau status)
   Invoice:  GET /orders/{code}/invoice (admin tarik manual)
```

---

## 11. Efisiensi Pertukaran Data (FE↔BE)
Prinsip: **minim round-trip, minim over/under-fetch**, tetap REST sederhana.

| Strategi | Aturan |
|---|---|
| Ringkas vs detail | List balas **baris ringkas** (tanpa nested berat); detail balas **agregat lengkap** |
| Agregasi detail order | `GET /orders/{code}` **sudah menyertakan** items+billing+payments+penalties (default) → 1 call, bukan 4. Sub-endpoint tetap untuk **refetch tertarget** setelah aksi |
| `?include=` | FE minta relasi yang perlu, mis. `GET /orders?include=items` |
| Pagination/filter/sort | server-side di semua list → FE tak tarik semua |
| Caching katalog | `Cache-Control` + `ETag` di `/products`,`/bundles`; invalidasi saat produk diubah |
| Kalkulasi 1× | `POST /orders/preview` → harga live 1 call; FE tak hitung ulang (jaga KG2) |
| Kompresi | gzip/brotli |
| Anti N+1 (server) | repository **eager-load** relasi (join), bukan query per-baris |

> **GraphQL/tRPC ditolak** untuk MVP (overengineering). REST + `?include=` cukup. Tinjau ulang bila query FE jadi sangat kompleks (Future).

## 12. Future / Phase 2
- **Inventory:** `GET /products/{code}/availability?start=&end=`, `POST /stock/movements`, endpoint **checklist gudang** (keluar/masuk) yang otomatis menggerakkan status.
- **Reporting:** `GET /reports/omzet`, `/reports/outstanding`, `/reports/popular-items`.
- **Payment gateway & akun customer:** login customer, webhook pembayaran.
