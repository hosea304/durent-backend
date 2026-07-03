# PROJECT_CONTEXT.md — DuRent Support Backend

> **Dokumen ini adalah titik masuk utama.** Setiap sesi Claude Code / developer WAJIB membaca file ini lebih dulu sebelum menyentuh kode, schema, atau API. File ini adalah sumber kebenaran untuk *tujuan, cakupan, dan batasan* proyek.

| Meta | Nilai |
|---|---|
| Nama proyek | DuRent Support — Backend Rental Produksi Film/Event |
| Fase saat ini | **Build dimulai.** Tahap 0 (scaffold) ✅ selesai (D21) — berikutnya **Tahap 1: Master/Catalog** per `TASK_BREAKDOWN.md`. |
| Status coding | 🟡 Scaffold NestJS+Prisma jalan (health check, kerangka 8 modul). Entity/endpoint bisnis **belum** dibuat. |
| Terakhir diperbarui | 2026-07-03 |
| Bahasa | Indonesia (istilah teknis boleh Inggris) |

---

## 1. Ringkasan Proyek

DuRent Support saat ini menjalankan operasional rental sepenuhnya di **Google Spreadsheet + Google Apps Script + Google Drive**. Tujuan proyek: **mengubahnya menjadi backend profesional** yang solid, rapi, scalable, dan terdokumentasi — **tanpa mengubah flow bisnis yang sudah berjalan** kecuali atas persetujuan eksplisit pemilik.

**Urutan pengerjaan:** Backend & dokumentasi dulu → frontend menyusul. Backend dirancang sejak awal agar mudah dikonsumsi frontend (customer-facing) nanti.

---

## 2. Tentang DuRent Support

Bisnis rental **kebutuhan produksi Film / Event** (BUKAN kamera, lighting, sound). Skala: ± **7–10 order/bulan**, ± **5–20 item per order**, qty per item bisa besar (mis. kursi).

**5 lini layanan** (satu order bisa mencampur semuanya):

| # | Lini | Sifat | Kembali? | Basis harga |
|---|---|---|---|---|
| 1 | Barang sewa (meja, tenda, kursi, HT) | rental | ✅ | per hari × unit |
| 2 | Barang habis pakai (lakban, plastik) | jual | ❌ | per unit |
| 3 | Jasa/kru (UPM, PU, Runner) | tenaga | ❌ | per orang × hari (fix) |
| 4 | Catering (paket A/B/C) | jual | ❌ | per paket (min 20, ada slot waktu) |
| 5 | Sewa lokasi ("Airbnb produksi") | rental | — | *(Phase 2)* |

Selain itu ada **bundling/paket** (harga khusus manual, juga berfungsi sebagai promo).

---

## 3. Sistem Saat Ini (yang harus dihormati)

- **File Operasional (Spreadsheet):** input pesanan, input denda, update pesanan, input status, Database Penyewaan, Database Denda, sheet inventory & sistem kode.
- **File Finance (Spreadsheet terpisah):** input & monitoring pelunasan.
- **Apps Script:** generate nomor order, tulis ke Database Penyewaan/Denda, update pesanan, rapikan invoice, export PDF, auto-folder ke Google Drive per tahun/bulan.
- **Penghubung antar-file:** `IMPORTRANGE` + `XLOOKUP`/`ARRAYFORMULA`.

> Detail lengkap: lihat [`CURRENT_SPREADSHEET_STRUCTURE.md`](CURRENT_SPREADSHEET_STRUCTURE.md) dan [`BUSINESS_FLOW.md`](BUSINESS_FLOW.md).

---

## 4. Tujuan Proyek (Phase 1 — Goals)

Tag: **[MVP]** = wajib di rilis pertama · **[Future]** = pengembangan lanjutan.

### 4.1 Business Goals
| Kode | Goal | Tag | Kenapa penting |
|---|---|---|---|
| BG1 | Pintu masuk order pindah dari WA-manual ke **website self-service** | MVP | Input manual admin = bottleneck & rawan salah ketik; customer bisa order sendiri, admin fokus konfirmasi + status |
| BG2 | **Pertahankan seluruh flow & format existing** (kode order, invoice, denda, status) | MVP | Transisi tidak boleh mengganggu operasi berjalan |
| BG3 | Buka jalan ke **payment gateway** & **sewa lokasi** | Future | Lini pendapatan & kemudahan bayar baru |

### 4.2 Backend Goals
| Kode | Goal | Tag | Kenapa penting |
|---|---|---|---|
| KG1 | Backend jadi **single source of truth** menggantikan 2 spreadsheet + IMPORTRANGE | MVP | Data order, denda, pembayaran konsisten di satu tempat |
| KG2 | Pindahkan **semua perhitungan** (durasi, total, diskon, deposit) ke server, direplikasi persis | MVP | Hilangkan ketergantungan formula sheet, hasil harus identik |
| KG3 | **Generator kode** order/denda andal (sequence), format dipertahankan | MVP | Ganti scan kolom yang rapuh |
| KG4 | **Auth + peran** (customer, admin, gudang) | MVP | Tiap aksi sesuai wewenang |
| KG5 | Integrasi **WhatsApp** (arahkan order ke admin) → payment gateway | Future | Sesuai tahapan integrasi |

### 4.3 Data Goals
| Kode | Goal | Tag | Kenapa penting |
|---|---|---|---|
| DG1 | Normalisasi tabel datar → **orders + order_items** (tetap dukung tanggal per-item) | MVP | Hilangkan pengulangan header, jaga integritas |
| DG2 | Model **master produk + sistem kode 4-level + bundling**, harga terpusat | MVP | Katalog & pricing rapi |
| DG3 | **Payment & penalty** jadi entitas tersendiri terhubung ke order | MVP | Ganti lookup antar-file |
| DG4 | Struktur **siap menampung stok/ketersediaan & lokasi** tanpa bongkar ulang | Future | Extensible untuk Phase 2 |

### 4.4 API Goals
| Kode | Goal | Tag |
|---|---|---|
| AG1 | API mengikuti **flow rental** (buat order multi-item multi-tanggal, hitung harga, terbitkan kode) — bukan CRUD telanjang | MVP |
| AG2 | Endpoint **katalog + harga** untuk halaman customer | MVP |
| AG3 | Endpoint **status** (checklist gudang keluar/masuk, override admin) + **pelunasan** (finance/admin) | MVP |
| AG4 | **Kontrak API stabil & terdokumentasi** agar frontend tidak menebak | MVP |

### 4.5 Frontend Preparation Goals
| Kode | Goal | Tag |
|---|---|---|
| FG1 | Data & format konsisten (harga, tanggal, status) siap dirender | MVP |
| FG2 | Dukung state loading/empty/error + tampilan **harga bundling** (asli dicoret → harga bundle) | MVP |
| FG3 | Antisipasi halaman **ketersediaan** & **lokasi** | Future |

### 4.6 Documentation Goals
| Kode | Goal | Tag |
|---|---|---|
| DOG1 | Kumpulan `.md` jadi **konteks utama** lintas sesi (tidak hilang arah) | MVP |
| DOG2 | Setiap keputusan teknis tercatat di **DECISION_LOG.md** | MVP |

### 4.7 Migration Goals
| Kode | Goal | Tag |
|---|---|---|
| MG1 | Migrasi **bertahap** — master produk & kode dulu, lalu order (bukan big-bang) | MVP |
| MG2 | **Validasi hitung** backend vs spreadsheet (harus identik) sebelum cutover | MVP |
| MG3 | Spreadsheet tetap jalan **paralel** sebagai fallback saat transisi | MVP |

### 4.8 Scalability Goals
| Kode | Goal | Tag |
|---|---|---|
| SG1 | Mulai dari **stack gratis** tapi arsitektur modular yang bisa migrasi hosting tanpa rewrite | MVP |
| SG2 | Siap **volume lebih besar**, payment gateway, multi-role, stok | Future |

---

## 5. Cakupan MVP & Keputusan Terkunci

| ID | Keputusan | Status |
|---|---|---|
| **D1** | Ketersediaan/stok **tidak diotomatiskan** di MVP. Customer ajukan booking → **admin konfirmasi manual**. Stok qty + ledger barang masuk/keluar + checklist gudang = **Phase 2**. Data disiapkan agar stok bisa nyambung nanti. | ✅ Terkunci |
| **D2** | Katalog MVP mencakup semua lini (barang sewa, habis pakai, catering, kru). | ✅ Terkunci |
| **D3** | **Sewa Lokasi ditunda ke Phase 2** (sebagai product type "location", struktur mirror item). | ✅ Terkunci |
| **D4** | **Overtime** dicatat lewat **kategori denda** (Rp100k/jam barang, Rp50k/jam kru). | ✅ Terkunci |
| **D5** | **Deposit/jaminan AKTIF di MVP.** | ✅ Terkunci |
| **D6** | Default **Status Pembayaran = "Belum Lunas"** (koreksi dari perilaku sheet yang default "Lunas"). | ✅ Terkunci |
| **D7** | Nomor order **tetap `DR-DDMMYY-NNNN`** dengan counter global. | ✅ Terkunci |
| **D8** | **Invoice otomatis ditunda ke Phase 2.** Backend = sumber kebenaran & menyajikan data order siap-invoice; selama dev, invoice **ditarik/di-render manual** dari data backend. **Backend tidak menulis balik ke Sheets** (tidak ada dual source of truth). | ✅ Terkunci |

---

## 6. Peran Pengguna

| Peran | Wewenang |
|---|---|
| **Customer / User** | Booking sendiri lewat website; lihat status pesanan & tagihan |
| **Gudang** | Checklist barang **keluar** (semua keluar → status *On Progress*) & **kembali** (semua kembali → *Completed*) |
| **Admin** | Kelola order, denda, pelunasan; **boleh override status** (koreksi kesalahan) |
| **Owner** | Tidak ada peran khusus (setara admin) |

---

## 7. Batasan Teknis & Integrasi

- **Tech stack (D20):** **NestJS + Prisma (TypeScript) + PostgreSQL**; hosting free-tier (Render/Railway + Neon/Supabase). Lihat `TECH_STACK.md`.
- **Hosting:** mulai dari **gratis**, harus bisa **migrasi** tanpa rewrite.
- **Integrasi:** **WhatsApp dulu** (arahkan order ke admin WA) → **payment gateway** menyusul.
- **Pembayaran saat ini:** mostly transfer, sebagian DP; ada juga bayar lunas di muka.

---

## 8. Prinsip Kerja & Guardrails (ringkas)

1. **Pahami sistem existing dulu**, jangan desain sistem ideal sebelum yang sekarang dipahami.
2. **Jangan ubah flow bisnis** tanpa persetujuan; kalau merekomendasikan perubahan → sertakan alasan, dampak, risiko, alternatif.
3. **Jangan buat schema final** sebelum mapping disetujui.
4. **Setiap keputusan teknis harus beralasan** & dicatat di `DECISION_LOG.md`.
5. **Hindari overengineering** — skala bisnis kecil (7–10 order/bulan), tapi arsitektur tetap scalable.
6. Kalau ada **inkonsistensi** kode vs dokumentasi → **tanya dulu.**

> Guardrail lengkap akan ditulis di `DEVELOPMENT_RULES.md`.

---

## 9. Indeks Dokumentasi (rencana)

| File | Isi | Status |
|---|---|---|
| `PROJECT_CONTEXT.md` | Orientasi utama (file ini) | ✅ Ada |
| `BUSINESS_FLOW.md` | Flow operasional & aturan harga | ✅ Ada |
| `CURRENT_SPREADSHEET_STRUCTURE.md` | Struktur sheet, kolom, kode, formula, risiko | ✅ Ada |
| `SPREADSHEET_TO_BACKEND_MAPPING.md` | Mapping sheet → calon backend | 🟡 Draft |
| `DATA_MODEL.md` | Entity, field, relasi | ✅ v1 (konsep final) |
| `BACKEND_ARCHITECTURE.md` | Arsitektur backend | ✅ Konsep |
| `TECH_STACK.md` | Tech stack terkunci (D20) | ✅ Ada |
| `API_CONTRACT.md` | Kontrak endpoint | ✅ Konsep |
| `FRONTEND_PREPARATION.md` | Kebutuhan frontend | ✅ Konsep |
| `MIGRATION_PLAN.md` | Strategi migrasi | ✅ Konsep |
| `DEVELOPMENT_RULES.md` | Guardrails vibe coding | ✅ Ada |
| `DECISION_LOG.md` | Riwayat keputusan teknis (D1–D18) | ✅ Ada |
| `TASK_BREAKDOWN.md` | Rincian task build | ✅ Ada |
| `FUTURE_ROADMAP.md` | Rencana lanjutan | ✅ Ada |
| `README.md` (root) | Pengantar & cara pakai docs | ✅ Ada |

---

## 10. Status Fase

- ✅ Phase 0 — Context Intake
- ✅ Phase 1 — Project Goals
- ✅ Phase 2 — Analisis Flow & Data Existing
- ✅ Phase 3 — Mapping + Data Model (v1 konsep final → D9–D15)
- ✅ Phase 4 — Backend Architecture (konsep → D16)
- ↪️ Phase 5 — (Rekomendasi Data Model sudah tercakup di DATA_MODEL.md Phase 3)
- ✅ Phase 6 — API Planning (konsep, stack-agnostic)
- ✅ Phase 7 — Frontend Preparation (konsep)
- ✅ Phase 8 — Migration Plan (D18 = Opsi A, terkunci)
- ✅ Phase 9 — Documentation System (README + peta docs)
- ✅ Phase 10 — Vibe Coding Guardrails (DEVELOPMENT_RULES)
- 🎉 **Planning Phase 0–10 SELESAI** + tech stack terpilih (D20). Berikutnya: **scaffold & build** sesuai `TASK_BREAKDOWN.md`
