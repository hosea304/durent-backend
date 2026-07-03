# FRONTEND_PREPARATION.md — Kesiapan Backend untuk Frontend

> Tujuan: memastikan backend **menyajikan data & kontrak yang membuat frontend mudah dibangun nanti.** **Bukan** desain UI detail. Basis: [`API_CONTRACT.md`](API_CONTRACT.md) · [`DATA_MODEL.md`](DATA_MODEL.md) · [`BUSINESS_FLOW.md`](BUSINESS_FLOW.md).
>
> Terakhir diperbarui: 2026-07-03 · Konsep.

---

## 1. Tiga Permukaan Frontend
| Permukaan | Pengguna | MVP? |
|---|---|---|
| **Customer site** | penyewa (guest) | MVP |
| **Admin dashboard** | admin/owner | MVP |
| **Gudang** | staf gudang | **Phase 2** |

---

## 2. Halaman × Data × Endpoint × State

### 2A. Customer (guest) — MVP
| Halaman | Data dibutuhkan | Endpoint | State penting |
|---|---|---|---|
| Katalog | produk/bundling aktif, filter per `type`, harga | `GET /products`, `GET /bundles` | loading, empty ("belum ada item"), error |
| Detail produk/bundling | detail + (bundling) komponen + `original_price`/`bundle_price` | `GET /products/{code}`, `GET /bundles/{code}` | loading, not-found |
| Form booking (keranjang) | pilih item, tanggal per-item, qty, promo; **preview harga** | `POST /orders/preview` (baru, §5) → `POST /orders` | validasi inline, kalkulasi harga live, error |
| Booking sukses | kode order, total, link WA admin | (respons `POST /orders`) | tampilkan `code` + `whatsapp_admin_url` |
| Cek status | status transaksi & pembayaran ringkas | `GET /orders/lookup?code=&phone=` | not-found, loading |

### 2B. Admin — MVP
| Halaman | Data | Endpoint | State |
|---|---|---|---|
| Login | — | `POST /auth/login` | error kredensial |
| Ringkasan *(Future)* | jml order pending-belum-konfirmasi, on-progress, belum-lunas, ambil hari ini | `GET /dashboard/summary` (**ditunda**, D19) | empty, loading |
| Daftar order | list + filter status/pembayaran/tanggal/cari | `GET /orders` | empty, paging, loading |
| Detail order | order lengkap + billing + denda + pembayaran (**1 panggilan agregat**) | `GET /orders/{code}` (menyertakan billing/payments/penalties) | loading, error |
| — aksi order | konfirmasi, edit, ubah status, batal | `POST /confirm`,`PATCH`,`POST /status`,`POST /cancel` | konfirmasi aksi, error |
| Input pembayaran | tambah dp/pelunasan/refund | `POST /orders/{code}/payments` | validasi jumlah |
| Input denda | buat denda `-D` | `POST /orders/{code}/penalties` | validasi |
| Kelola katalog | CRUD produk/bundling/voucher, pratinjau kode | `.../products`,`/bundles`,`/vouchers`,`/products/preview-code` | empty, error unik-kode (409) |
| Lihat invoice | payload siap-invoice (render/print manual, D8) | `GET /orders/{code}/invoice` | loading |

### 2C. Gudang — Phase 2
Checklist barang keluar/masuk per order → gerakkan status. Endpoint inventory Phase 2.

---

## 3. UI State yang Wajib Didukung Backend
| State | Dukungan backend |
|---|---|
| **Loading** | respons cepat; operasi berat (hitung) tetap di server |
| **Empty** | list selalu balas **array kosong + `meta.total=0`** (bukan null/404) |
| **Error** | bentuk konsisten `{ error: { code, message, details[] } }` + HTTP status tepat |
| **Validasi** | `422` dengan `details[]` per-field (frontend tandai field bermasalah) |
| **Paging** | `meta: { page, limit, total }` di semua list |

---

## 4. Konsistensi Format Data (backend = sumber format kanonik)
Backend mengembalikan **nilai kanonik**; frontend yang memformat tampilan.

| Data | Format backend | Contoh tampilan |
|---|---|---|
| Uang | integer rupiah | `150000` → "Rp 150.000" |
| Tanggal | ISO-8601 | `2026-07-10` → "10 Jul 2026" |
| Durasi | integer hari | `2` → "2 hari" |
| Telepon | string apa adanya | |

**Enum + label (disepakati agar FE & BE konsisten):**
| Enum | Nilai → Label |
|---|---|
| status_transaksi | `pending`→Menunggu · `on_progress`→Sedang Berjalan · `completed`→Selesai · `cancel`→Dibatalkan |
| status_pembayaran | `belum_lunas`→Belum Lunas · `sebagian`→Sebagian/DP · `lunas`→Lunas |
| delivery_slot | `pagi` · `siang` · `sore` |
| penalty.category | `kerusakan` · `kehilangan` · `overtime` · `lainnya` |
| dp_disposition | `refund_full`→Refund Penuh · `forfeit`→Hangus · `partial`→Sebagian · `none`→Tidak Ada |

---

## 5. Penyesuaian Backend yang Terungkap dari Kebutuhan Frontend
Dua endpoint baru yang membuat frontend jauh lebih mudah — **usulan, minta persetujuan:**

| Endpoint | Kenapa | Prioritas |
|---|---|---|
| **`POST /orders/preview`** 🟢 | Frontend butuh **harga live** saat customer menyusun booking, **tanpa menyimpan**. Menghindari frontend menghitung sendiri (jaga KG2: kalkulasi hanya di server). Body = sama seperti `POST /orders`, respons = total tanpa membuat order. | **✅ MVP (diambil, D19)** |
| **`GET /dashboard/summary`** 🔵 | Ringkasan angka untuk halaman utama admin (pending, belum lunas, ambil hari ini). | **Ditunda → Future** (bareng reporting, D19) |

---

## 6. Yang Backend Sudah Siapkan agar Frontend Ringan
- **Semua perhitungan sudah jadi di server** (durasi, total, diskon, deposit) → frontend cukup menampilkan.
- **`original_price` vs `bundle_price`** sudah dihitung → tinggal render harga coret (FG2).
- **`whatsapp_admin_url`** sudah dibentuk → tombol "Chat Admin" tinggal pakai.
- **Payload `GET /invoice`** lengkap → render invoice manual tanpa gabung banyak endpoint.
- **Filter & paging** di list → tabel admin siap.

---

## 7. Fitur Frontend Masa Depan yang Diantisipasi
| Fitur | Butuh backend |
|---|---|
| **Kalender ketersediaan** (customer lihat slot kosong) | Inventory + `GET availability` (Phase 2) |
| **Akun customer** (riwayat, login) | Auth customer (Future) |
| **Bayar online** | Payment gateway adapter (Future) |
| **Dashboard laporan** (omzet, item populer, tunggakan) | Reporting endpoints (Future) |
| **Checklist gudang** | Inventory/status Phase 2 |

> Struktur data & API sekarang **sudah dibuat extensible** untuk semua ini tanpa bongkar ulang.
