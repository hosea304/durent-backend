# FUTURE_ROADMAP.md — Rencana Lanjutan (Phase 2+)

> Kumpulan fitur/keputusan yang **sengaja ditunda** dari MVP, beserta alasan & ketergantungannya. Struktur data & API MVP sudah dibuat **extensible** untuk semua ini. Terakhir diperbarui: 2026-07-03.

---

## Phase 2 (setelah MVP stabil)

| Fitur | Kenapa ditunda | Bergantung pada | Ref |
|---|---|---|---|
| **Inventory / stok + availability** (barang masuk-keluar, cek ketersediaan otomatis) | Belum ada data unit fisik; MVP pakai konfirmasi manual | onboarding hitung unit fisik | D1 |
| **Checklist gudang** (keluar/masuk → auto status On Progress/Completed) | Butuh stok & peran gudang aktif | inventory | BUSINESS_FLOW §4 |
| **Sewa Lokasi** (product type `location`, ala Airbnb produksi) | Rencana pengkodean/atribut belum matang | desain atribut lokasi (O3) | D3 |
| **Bundle di order dipecah komponen** | Baru perlu saat tracking stok | inventory | D10 |
| **Invoice native** (PDF di backend + auto-folder Drive) | Reuse aset existing dulu; bukan jalur kritis MVP | template render | D8 |
| **Import data historis** (order/payment/denda lama) | Risiko tinggi; MVP mulai dari order baru | parity & grouping | D18 |
| **Migrasi historis lanjutan & retire file finance** | Pelunasan pindah penuh ke backend | payments matang | MIGRATION_PLAN §9 |

## Future (jangka lebih panjang)

| Fitur | Kenapa | Ref |
|---|---|---|
| **Payment gateway** (bayar online) | MVP arahkan ke admin WA dulu | D-integrasi, BACKEND_ARCHITECTURE §14 |
| **Akun customer / login** (riwayat, self-service penuh) | MVP pakai guest | D11 |
| **Reporting / dashboard** (omzet, item populer, tunggakan) | Kebutuhan laporan ditunda oleh pemilik | Goals §4.x |
| **Role finance terpisah** dari admin | MVP: finance = fungsi admin | BACKEND_ARCHITECTURE §7 |
| **Deposit lanjutan** (kebijakan jaminan lebih detail) | MVP: deposit dasar aktif | D5 |
| **WhatsApp API penuh** (otomatis, bukan klik-chat) | MVP: arahkan ke admin WA | — |

---

## Pertanyaan Terbuka yang Menunggu
- **O3** — detail sewa lokasi (pengkodean, atribut) → dijawab saat mulai Phase 2 lokasi.
