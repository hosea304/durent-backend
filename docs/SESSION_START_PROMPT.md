# SESSION_START_PROMPT.md — Prompt Pembuka Sesi Coding

> Salin seluruh blok di bawah ke chat Claude Code baru (dibuka di folder `d:\Durent-App`) untuk memulai/melanjutkan build tanpa kehilangan konteks. Ganti bagian "Pekerjaan sesi ini" bila sudah lewat Tahap 0.

---

```
Ini proyek backend "DuRent Support" — sistem rental kebutuhan produksi film/event.
Planning Phase 0–10 sudah SELESAI; seluruh konteks ada di folder docs/ dan catatan
memori proyek. Kita sekarang di tahap MULAI CODING. Balas dalam Bahasa Indonesia.

== LANGKAH PERTAMAMU ==
1) Baca berurutan: README.md → docs/PROJECT_CONTEXT.md → docs/DEVELOPMENT_RULES.md →
   docs/TECH_STACK.md → docs/BACKEND_ARCHITECTURE.md → docs/DATA_MODEL.md →
   docs/API_CONTRACT.md → docs/TASK_BREAKDOWN.md.
   (BUSINESS_FLOW, CURRENT_SPREADSHEET_STRUCTURE, SPREADSHEET_TO_BACKEND_MAPPING,
   MIGRATION_PLAN, FRONTEND_PREPARATION, FUTURE_ROADMAP, DECISION_LOG dibaca saat relevan.)
2) Ringkas singkat pemahamanmu (stack, arsitektur, keputusan utama D1–D20) supaya
   saya yakin konteks sudah termuat.

== ATURAN MAIN (docs/DEVELOPMENT_RULES.md) ==
- Dokumentasi = sumber kebenaran. Kode mengikuti docs, bukan sebaliknya.
- JANGAN ubah flow bisnis, data model, entity/field, atau API di luar dokumen tanpa
  persetujuan saya. Jika perlu perubahan, ajukan sebagai USULAN (alasan, dampak, risiko,
  alternatif) lalu tunggu persetujuan.
- JANGAN pilih/ganti library besar di luar TECH_STACK.md tanpa dibahas.
- Hindari overengineering (bisnis kecil, ~7–10 order/bulan): modular monolith,
  REST + ?include=, BUKAN microservices/GraphQL.
- Semua kalkulasi uang HANYA di Pricing Engine. Uang = integer rupiah (tanpa float).
- products.code & orders.code unik & TIDAK boleh direuse; hapus = soft delete.
  Kode order = DR-DDMMYY-NNNN (counter global, tak reset); kode denda = <order>-D.
- Catat setiap keputusan teknis penting ke docs/DECISION_LOG.md (lanjut dari D20).
  Tandai task selesai di docs/TASK_BREAKDOWN.md.
- Kalau menemukan inkonsistensi kode vs docs, TANYA dulu.

== STACK (D20) ==
NestJS + Prisma (TypeScript) + PostgreSQL; hosting free-tier (app: Render/Railway;
DB: Neon/Supabase). Validasi class-validator, API docs Swagger, test Jest,
rate-limit @nestjs/throttler.

== PEKERJAAN SESI INI — TASK_BREAKDOWN Tahap 0 (Scaffold) ==
- Susun struktur proyek NestJS sesuai TECH_STACK.md §5 (modul: auth, users, customers,
  catalog, orders, payments, penalties, integrations; folder common/ untuk
  guard/pipe/filter/interceptor; folder prisma/).
- Setup Prisma + koneksi PostgreSQL + config env (@nestjs/config, .env; jangan commit rahasia).
- Siapkan kerangka lintas-modul: global exception filter (bentuk error
  {error:{code,message,details}}), global validation pipe, Swagger, throttler, logger terstruktur.
- BELUM membuat entity/endpoint bisnis — cukup skeleton yang jalan + endpoint health check.

== PENTING ==
Sebelum menulis kode apa pun, TAMPILKAN dulu RENCANA scaffold (struktur folder + daftar
dependency + langkah), lalu minta persetujuan saya. Setelah saya setujui, baru eksekusi.
Di akhir: tandai Tahap 0 di docs/TASK_BREAKDOWN.md dan catat keputusan struktur (bila ada)
ke docs/DECISION_LOG.md.
```
