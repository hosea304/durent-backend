# DuRent Support — Aplikasi Rental Produksi Film/Event

Sistem untuk bisnis rental kebutuhan produksi **Film/Event** (DuRent Support), menggantikan sistem berbasis Google Spreadsheet + Apps Script menjadi backend profesional yang scalable & terdokumentasi (frontend menyusul).

**Status:** 🟢 Tahap 0–3 ✅ — scaffold · Master/Catalog (data asli terimport) · Auth JWT+RBAC (D24) · **Orders + Pricing Engine (D25): booking guest, kode `DR-`, konfirmasi/status/cancel admin** (migrasi terapply, e2e 12/12 hijau) — berikutnya Tahap 4 (Payments) di `docs/TASK_BREAKDOWN.md`.

## 🗂️ Struktur Repo (D23)

| Folder | Isi | Kalau mau memperbaiki… |
|---|---|---|
| [`backend/`](backend/) | API NestJS + Prisma (semua kode server) | logika bisnis, endpoint, database → **di sini** |
| [`frontend/`](frontend/) | *placeholder* — situs customer & dashboard admin (fase berikutnya) | tampilan/halaman web → **di sini** (nanti) |
| [`docs/`](docs/) | Dokumentasi = **sumber kebenaran** bersama | aturan/kontrak/keputusan |
| [`tools/`](tools/) | Alat bantu dev — `api-tester.html` (25 smoke test hijau/merah, termasuk alur booking) | — |

**Menjalankan & menguji backend** (semua perintah dari folder `backend/`):
```
npm run start:dev     # jalankan server (hot-reload) → http://localhost:3000
npm test              # unit test
npm run test:e2e      # end-to-end test
```
Uji visual: buka `tools/api-tester.html` di browser (klik **Jalankan Semua Tes**), atau Swagger UI di **http://localhost:3000/api/docs**.

---

## 📖 Cara Pakai Dokumentasi Ini (WAJIB dibaca Claude Code / developer)

Semua konteks proyek ada di folder [`docs/`](docs/). **Sebelum melakukan apa pun, baca sesuai urutan & konteks di bawah.**

### Urutan baca pertama kali
1. [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — orientasi utama, tujuan, cakupan MVP, keputusan terkunci.
2. [`docs/DEVELOPMENT_RULES.md`](docs/DEVELOPMENT_RULES.md) — **aturan main** (boleh/tidak, kapan tanya, kapan update docs).
3. [`docs/BUSINESS_FLOW.md`](docs/BUSINESS_FLOW.md) — flow bisnis rental.
4. [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) + [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — bentuk data & endpoint.

### Peta dokumen
| File | Untuk | Baca sebelum… | Update saat… |
|---|---|---|---|
| `PROJECT_CONTEXT.md` | Orientasi, goals, keputusan, status fase | mulai apa pun | cakupan/keputusan/fase berubah |
| `DEVELOPMENT_RULES.md` | Guardrails vibe coding | coding | aturan kerja berubah |
| `BUSINESS_FLOW.md` | Flow order/status/bayar/denda | mengubah logika bisnis | flow berubah (perlu approval) |
| `CURRENT_SPREADSHEET_STRUCTURE.md` | Struktur existing (as-is) | migrasi / bandingkan data | pemahaman existing bertambah |
| `SPREADSHEET_TO_BACKEND_MAPPING.md` | Peta kolom → field | bikin schema/import | mapping berubah |
| `DATA_MODEL.md` | Entity, field, relasi | sentuh DB/model | model berubah (perlu approval) |
| `BACKEND_ARCHITECTURE.md` | Arsitektur, layering, modul | bikin struktur kode | arsitektur berubah |
| `API_CONTRACT.md` | Endpoint & efisiensi FE↔BE | bikin/ubah endpoint | endpoint berubah |
| `FRONTEND_PREPARATION.md` | Kebutuhan data frontend | fitur berdampak ke FE | kebutuhan FE berubah |
| `MIGRATION_PLAN.md` | Strategi pindah data | migrasi | strategi berubah |
| `DECISION_LOG.md` | Riwayat keputusan (D1–D18) | ambil keputusan teknis | **setiap** keputusan penting |
| `TASK_BREAKDOWN.md` | Rincian task build | mulai/selesai task | **setiap** task selesai |
| `FUTURE_ROADMAP.md` | Rencana Phase 2/Future | menilai scope | ada ide/scope baru |

---

## 🧭 Ringkasan Keputusan Kunci
- MVP = **customer self-booking** lewat website; admin konfirmasi ketersediaan manual (belum ada stok — Phase 2).
- 5 lini: barang sewa, habis pakai, kru, catering, (lokasi = Phase 2). Ada bundling.
- Kode order `DR-DDMMYY-NNNN` (counter global) dipertahankan; denda `-D`.
- Arsitektur: **modular monolith**, layered, relational DB, uang integer rupiah, kalkulasi terpusat di **Pricing Engine**.
- Invoice otomatis = Phase 2; MVP tarik data manual.
- Semua keputusan detail: [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md).

## ⏭️ Langkah Berikutnya
- Review pemilik atas D25 ① (pembulatan Rp1 diskon persen/deposit) & ⑥ (dedup customer per phone) di `docs/DECISION_LOG.md`.
- Lanjut build [`docs/TASK_BREAKDOWN.md`](docs/TASK_BREAKDOWN.md) → **Tahap 4: Payments** (ledger dp/pelunasan/refund + derive status pembayaran).

---

## 🚀 Memulai Sesi Coding Baru (Claude Code)

1. Buka Claude Code **di folder proyek ini** (`d:\Durent-App`) — catatan memori proyek + folder `docs/` otomatis tersedia.
2. Tempel prompt pembuka ini:

```
Ini proyek backend DuRent Support. Sebelum apa pun, baca README.md lalu
docs/PROJECT_CONTEXT.md dan docs/DEVELOPMENT_RULES.md (plus file yang dirujuk).
Ikuti dokumentasi sebagai sumber kebenaran: JANGAN ubah flow bisnis, data model,
atau API tanpa persetujuan saya, dan catat keputusan penting ke docs/DECISION_LOG.md.
Lanjutkan dari docs/TASK_BREAKDOWN.md pada tahap pertama yang belum selesai
(kerjakan ⚠️ catatan tertunda lebih dulu bila ada).
```

3. Claude Code akan membaca konteks, lalu mengusulkan langkah berikutnya — Anda tinggal setujui/koreksi.

> Prompt pembuka **versi lengkap** (siap salin) ada di [`docs/SESSION_START_PROMPT.md`](docs/SESSION_START_PROMPT.md). Aturan main lengkap di [`docs/DEVELOPMENT_RULES.md`](docs/DEVELOPMENT_RULES.md).
