# TECH_STACK.md — Tech Stack DuRent (Terkunci, D20)

> Stack final untuk build. Basis arsitektur: [`BACKEND_ARCHITECTURE.md`](BACKEND_ARCHITECTURE.md). Terakhir diperbarui: 2026-07-03.

---

## 1. Pilihan

| Lapis | Pilihan | Alasan |
|---|---|---|
| Bahasa | **TypeScript** (Node.js LTS) | Anda familiar JS dari Apps Script; type-safe; 1 bahasa bila frontend React/Next |
| Framework | **NestJS** | **Modular by-design** → cocok persis dengan modular monolith + layered |
| ORM | **Prisma** | Type-safe, migrasi rapi (Prisma Migrate), DX bagus |
| Database | **PostgreSQL** | Relational, integritas finansial, free-tier (Neon/Supabase), scalable |
| Hosting app | **Render / Railway** (free tier) | Gratis dulu, naik kelas tanpa rewrite |
| Hosting DB | **Neon / Supabase** (Postgres free) | Managed, backup otomatis |

## 2. Library Pendukung
| Kebutuhan | Tool |
|---|---|
| Validasi (DTO) | `class-validator` + `class-transformer` |
| Auth staff | `@nestjs/passport` + JWT (`@nestjs/jwt`), hash `bcrypt`/`argon2` |
| Config/env | `@nestjs/config` |
| Rate limit | `@nestjs/throttler` (endpoint publik) |
| API docs | `@nestjs/swagger` → OpenAPI otomatis (kontrak untuk frontend) |
| Test | **Jest** (bawaan Nest) — wajib untuk **paritas Pricing Engine** |
| Logging | `nestjs-pino` / Logger bawaan (structured) |

## 3. Pemetaan NestJS → Arsitektur Kita
| Konsep NestJS | Peran di desain |
|---|---|
| **Module** | Modul domain (Auth, Customers, Catalog, Orders, Payments, Penalties, Integrations) |
| **Controller** | API layer (endpoint) |
| **Provider/Service** | Business logic — termasuk **Pricing Engine** & **Code Generator** (injectable) |
| **Prisma Service** | Repository/data layer |
| **Guard** | Auth + RBAC (role) |
| **Pipe** | Validasi input |
| **Interceptor** | Logging + bentuk response konsisten |
| **Exception Filter** | Error handling (shape `{ error: { code, message, details } }`) |

## 4. Konvensi Teknis
- Uang: **integer rupiah** (`BigInt`/`Int` di Prisma) — tanpa float.
- Kode unik (`products.code`, `orders.code`) via constraint unik; soft delete `is_active`.
- Semua kalkulasi hanya di **Pricing Engine** service.
- Migrasi DB via **Prisma Migrate** (versi terlacak).
- Env rahasia via `.env` (tak masuk repo).

## 5. Struktur Proyek (rencana awal)
```
src/
  main.ts
  app.module.ts
  common/           (guards, pipes, filters, interceptors, utils)
  prisma/           (PrismaService, schema.prisma)
  modules/
    auth/  users/  customers/
    catalog/        (products, bundles, code, vouchers)
    orders/         (+ pricing-engine, code-generator)
    payments/  penalties/  integrations/
prisma/
  schema.prisma
  migrations/
test/               (unit + paritas pricing)
```
> Struktur final dikonfirmasi saat scaffold (TASK_BREAKDOWN Tahap 0).
