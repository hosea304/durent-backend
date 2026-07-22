# DEVELOPMENT_RULES.md — Guardrails Vibe Coding (Phase 10)

> Aturan main saat coding DuRent dengan Claude Code. Tujuannya: **konsisten dengan flow bisnis, tidak overengineering, tidak keluar arah.** Baca ini + `PROJECT_CONTEXT.md` sebelum menulis kode.
>
> Terakhir diperbarui: 2026-07-03.

---

## 1. ✅ Yang BOLEH dilakukan
- Menulis kode yang **mengikuti** DATA_MODEL, API_CONTRACT, BACKEND_ARCHITECTURE yang sudah disepakati.
- Menambah test (terutama **Pricing Engine** — wajib uji paritas dengan formula sheet).
- Refactor kecil untuk kerapian **tanpa** mengubah kontrak/flow.
- Mengusulkan perbaikan — **sebagai usulan**, disertai alasan/dampak/risiko/alternatif.

## 2. ⛔ Yang TIDAK BOLEH (tanpa persetujuan)
- Mengubah **flow bisnis** (order/status/invoice/bayar/denda) — baca `BUSINESS_FLOW.md` dulu.
- Mengubah **entity/field/relasi** di luar `DATA_MODEL.md`.
- Menambah/mengubah **endpoint** di luar `API_CONTRACT.md`.
- Mengubah **format kode** order/denda (website: `DR-DDMMYY-NNNN-W`, `…-W-D` — D30; sheet: `DR-DDMMYY-NNNN`, `-D`) atau aturan hitung.
- Menghapus data secara permanen (produk = **soft delete**; kode **tak boleh direuse**).
- Memilih/ganti **tech stack, DB vendor, atau library besar** tanpa dibahas.
- Membuat entity/tabel/API **berdasarkan asumsi** kebutuhan umum rental.

## 3. 🙋 Kapan HARUS tanya dulu
- Ada **inkonsistensi** antara kode dan dokumentasi.
- Kebutuhan baru yang **belum ada keputusannya** di DECISION_LOG.
- Sesuatu yang **berdampak ke flow, data model, API, atau uang**.
- Pertanyaan terbuka yang masih tercatat (mis. **O3** sewa lokasi).

## 4. 👍 Kapan BOLEH langsung coding
- Task sudah ada di `TASK_BREAKDOWN.md` **dan** sesuai dokumen yang disepakati.
- Perubahan murni internal (implementasi) tanpa menyentuh kontrak/flow.

## 5. 📝 Kapan HARUS update dokumentasi
| Kejadian | Update |
|---|---|
| Keputusan teknis/bisnis penting | `DECISION_LOG.md` (Dxx baru) |
| Task mulai/selesai | `TASK_BREAKDOWN.md` |
| Endpoint berubah | `API_CONTRACT.md` |
| Model berubah (setelah approval) | `DATA_MODEL.md` + `SPREADSHEET_TO_BACKEND_MAPPING.md` |
| Arsitektur berubah | `BACKEND_ARCHITECTURE.md` |
| Ide/scope baru | `FUTURE_ROADMAP.md` |

## 6. 🔒 Menjaga Konsistensi (DB · API · Flow)
- **Sumber kebenaran = docs.** Kode mengikuti docs, bukan sebaliknya. Kalau kode perlu menyimpang → ubah docs dulu (dengan approval), baru kode.
- Nama field/enum mengikuti DATA_MODEL & tabel enum→label di `FRONTEND_PREPARATION.md`.
- **Semua kalkulasi uang hanya di Pricing Engine** (satu tempat). Frontend & modul lain tidak menghitung ulang.

## 7. 🧯 Mencegah Overengineering
- Skala bisnis **7–10 order/bulan** — utamakan yang **sederhana & cukup**.
- Tetap **modular monolith**, bukan microservices; **REST + `?include=`**, bukan GraphQL.
- Jangan bangun fitur Future (stok, gateway, akun customer, reporting) sebelum MVP jalan — cukup **siapkan struktur**.

## 8. 🎯 Menjaga Backend Siap Frontend
- Kembalikan data **kanonik & konsisten** (integer rupiah, tanggal ISO, enum baku).
- List = ringkas, detail = agregat; sediakan state **loading/empty/error** yang benar (array kosong + `meta`, bukan null).

## 9. ✔️ Definition of Done (per task)
1. Sesuai DATA_MODEL & API_CONTRACT.  2. Ada validasi + error shape konsisten.  3. Ada test (khusus hitung: uji paritas vs sheet).  4. Docs terkait diupdate.  5. `TASK_BREAKDOWN.md` ditandai selesai; keputusan → `DECISION_LOG.md`.

## 10. 🔑 Aturan "Baca-Sebelum" (ringkas)
| Sebelum… | Baca |
|---|---|
| coding apa pun | `PROJECT_CONTEXT.md` + file ini |
| mengubah flow | `BUSINESS_FLOW.md` |
| menyentuh DB/model | `CURRENT_SPREADSHEET_STRUCTURE.md`, `SPREADSHEET_TO_BACKEND_MAPPING.md`, `DATA_MODEL.md` |
| membuat endpoint | `API_CONTRACT.md` |
| fitur berdampak FE | `FRONTEND_PREPARATION.md` |
| setelah keputusan penting | tulis ke `DECISION_LOG.md` |
