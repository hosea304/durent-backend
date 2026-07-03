# BUSINESS_FLOW.md — Flow Operasional DuRent Support

> Dokumentasi **flow bisnis yang sedang berjalan (as-is)** + catatan perubahan yang disepakati untuk MVP. **Baca file ini sebelum mengubah apa pun yang berhubungan dengan alur order, status, invoice, pembayaran, atau denda.**
>
> Terakhir diperbarui: 2026-07-03 · Sumber: wawancara pemilik + source code Apps Script.

---

## 1. Aktor

| Aktor | Peran dalam flow |
|---|---|
| Customer | Meminta/ membuat order |
| Admin | Input/kelola order (saat ini), terbitkan invoice, kelola denda & pelunasan, ubah status |
| Gudang | Serahkan & terima barang (checklist keluar/masuk) |
| Finance | Monitor & input pelunasan (file terpisah) |

---

## 2. Alur Order End-to-End (AS-IS)

```
1. Customer chat WhatsApp
2. Admin kirim pricelist
3. Customer sebutkan kebutuhan (item, qty, tanggal)
4. Admin input di "Dashboard Input Pesanan"
5. Apps Script generate Kode Transaksi → tulis ke "Database Penyewaan"
6. Invoice dibangun (formula + Apps Script) → pilih kode → export PDF
   → auto-folder ke Google Drive (per tahun/bulan)
7. Invoice dikirim ke customer
8. Pembayaran (mostly bayar di muka; sebagian DP)
9. Barang diambil per tanggal pengambilan (bisa beda tanggal per item)
10. Barang dikembalikan per tanggal pengembalian
11. Order selesai
```

### Catatan kunci
- **Tanggal ambil & kembali melekat di level ITEM, bukan order.** Dalam 1 invoice, meja bisa tanggal 4 dan tenda tanggal 5. Ini **wajib dipertahankan.**
- **Satu order = banyak item = banyak baris** di Database Penyewaan (header order diulang tiap baris — lihat `CURRENT_SPREADSHEET_STRUCTURE.md`).

### Perubahan yang disepakati untuk MVP (TO-BE)
- **Langkah 1–4 berubah:** customer **input order sendiri** lewat website (bukan admin).
- **Ketersediaan tidak dicek otomatis** (D1): setelah customer submit, **admin konfirmasi ketersediaan manual** (barang bisa disubrental bila stok sendiri habis). Barulah order dikonfirmasi.
- Integrasi **WhatsApp**: order diarahkan ke admin WA lebih dulu; payment gateway menyusul (Future).

---

## 3. Status Transaksi

Sumber: sheet **"Input Status Transaksi"** (diinput admin) → ditarik ke kolom Status Transaksi di Database Penyewaan.

| Status | Arti | Pemicu |
|---|---|---|
| **Pending** | Order dibuat, barang belum keluar | Default saat order terbit |
| **On Progress** | Barang sudah diambil | Semua item di-checklist keluar oleh gudang |
| **Completed** | Barang sudah dikembalikan | Semua item di-checklist kembali |
| **Cancel** | Order dibatalkan | Di-set manual |

> Aturan MVP: transisi **On Progress/Completed** idealnya otomatis dari checklist gudang, tapi **admin tetap boleh override** untuk koreksi.

---

## 4. Alur Pengambilan & Pengembalian (Gudang)

- Gudang membuka transaksi yang barangnya akan diambil hari itu.
- **Checklist keluar** per item → jika **semua** item keluar → status **On Progress**.
- Saat kembali, **checklist masuk** per item → jika **semua** kembali → status **Completed**.
- Karena tanggal per-item, satu order bisa sebagian *On Progress* (sebagian item sudah keluar, sebagian belum). *(Perlu dipertimbangkan di data model Phase 3.)*

---

## 5. Alur Invoice

- Invoice dibuat dari data order (per Kode Transaksi) memakai formula + Apps Script untuk merapikan tabel.
- Export **PDF**, disimpan otomatis ke Google Drive **tersortir per tahun & bulan**.
- **Tanggal Invoice = tanggal input order** (dipertahankan saat update — tidak berubah).

> **Invoice = view dari order** (nomor invoice = Kode Transaksi, tidak ada penomoran terpisah). **Keputusan D8:** invoice otomatis ditunda ke Phase 2. Untuk MVP/dev, invoice **ditarik/di-render manual** dari data backend; **backend tidak menulis balik ke Sheets.** Syarat: backend harus menyimpan & menyajikan semua field yang dibutuhkan invoice (header + seluruh baris item + total).

---

## 6. Alur Pembayaran & Pelunasan (Finance — file terpisah)

- Finance **menarik data transaksi**, menjumlahkan **Total Tagihan per order** (termasuk denda bila ada).
- Input di **"Input Pelunasan"**: `Kode Transaksi, Nama Penyewa, Total Tagihan, Tanggal Bayar, Total Dibayar`.
- **Total Dibayar ≥ Total Tagihan → Lunas.**
- Status pembayaran ditarik balik ke Database Penyewaan lewat IMPORTRANGE.
- **Pembayaran dilacak per-ORDER, bukan per-item.**

> ⚠️ **Risiko existing:** formula default "Lunas" bila order belum ada di sheet Pelunasan. **Di backend default = "Belum Lunas"** (keputusan D6).

### Skema uang
| Konsep | Arti | Catatan |
|---|---|---|
| **DP (50%)** | Flag "bayar 50% di muka" | Boolean; **tidak** mengubah nilai total |
| **Deposit (%)** | Jaminan, **ditambahkan di atas** grand total | Aktif di MVP (D5); `Grand Total + Deposit` |
| **Diskon** | Per baris item; via kode voucher; **persen ATAU nominal** | Hanya baris ber-checkbox diskon |
| **Biaya tambahan** | Ongkir/kirim | Input manual |

---

## 7. Alur Denda (kerusakan / kehilangan / overtime)

- Input di **"Dashboard Input Denda"** dengan No Invoice (kode order) sebagai referensi.
- Apps Script generate **Kode Denda = Kode Order + `-D`** (mis. `DR-230425-0001-D`).
- Tiap baris: Nama Barang, Kode Barang, **Kategori Denda**, Alasan, Qty, Denda per Qty → `Denda Total = Qty × Denda per Qty`.
- Ditulis ke **"Database Denda"**; status & nama penyewa di-lookup.
- **Overtime** masuk sebagai **kategori denda** (D4): Rp100.000/jam untuk barang, Rp50.000/jam untuk kru.

---

## 8. Alur Pembatalan

- Order di-set status **"Cancel"** lewat input status.
- *(Aturan DP hangus / refund saat cancel belum dijelaskan — perlu dikonfirmasi sebelum diimplementasi.)*

---

## 9. Aturan Harga & Perhitungan

**Waktu sewa:** 1 hari = **04:00–24:00**, toleransi keterlambatan **1 jam**.

| Besaran | Rumus / aturan |
|---|---|
| **Durasi** | `(Tgl Selesai − Tgl Mulai) + 1` — inklusif; hari yang sama = 1 hari |
| **Amount** | `Qty × Unit Price` |
| **Rental Total** | `Durasi × Amount` |
| **Diskon (baris)** | Persen → `RentalTotal − (RentalTotal × %)`; Nominal → `RentalTotal − nominal` |
| **Sub Total** | Rental Total setelah diskon |
| **Grand Total** | `Σ Sub Total` semua item |
| **Deposit Amount** | `Σ Rental Total × Deposit%` (atas dasar pra-diskon) |
| **Grand Total + Deposit** | `Grand Total + Deposit Amount` |

### Aturan per lini
| Lini | Aturan harga |
|---|---|
| Barang sewa | per hari × unit; overtime Rp100k/jam (via denda) |
| Barang habis pakai | per unit (tanpa durasi/kembali) |
| Kru/jasa | **fix per orang per hari** (mis. Rp500k/hari/orang); **1 kru = 1 job/hari**; overtime Rp50k/jam (via denda) |
| Catering | per paket; **minimum 20**; ada **slot waktu kirim** (pagi/siang/sore) & batch terpisah (mis. 60 = 20+20+20) — *belum termodel di sheet, saat ini via chat* |
| Bundling | **harga khusus manual**; frontend tampilkan **harga asli dicoret → harga bundle** |

> ⚠️ **Gap untuk backend:** slot waktu catering & konsep 1-kru-1-job belum ada di struktur spreadsheet — akan diangkat di Phase 3.
