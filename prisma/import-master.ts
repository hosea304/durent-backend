/**
 * Import master data dari spreadsheet "Database Inventory" (MIGRATION_PLAN Tahap 1–2).
 *
 * Pakai:  npx ts-node prisma/import-master.ts <path.xlsx> [--dry-run] [--clean-test]
 *
 * - Idempotent: upsert by `code` (aman diulang).
 * - Kode diambil APA ADANYA dari sheet (kontinuitas D7/D12), dengan satu
 *   normalisasi: kode yang tidak berakhiran 4 digit (bug formula sheet pada
 *   "Documentation crew") dilengkapi `-NNNN` dari kolom Code Number.
 * - Field yang tak ada di sheet (pricing_basis, unit_label, min_qty,
 *   is_returnable) diisi aturan turunan MIGRATION_PLAN §4 — perlu review pemilik.
 * - `--clean-test`: hapus data uji dev yang bukan berasal dari sheet
 *   (bundle DS-RT-CM-0001, voucher PROMO10).
 */
import 'dotenv/config';
import * as XLSX from 'xlsx';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PricingBasis,
  PrismaClient,
  ProductType,
} from '../src/generated/prisma/client';

const xlsxPath = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');
const CLEAN_TEST = process.argv.includes('--clean-test');

if (!xlsxPath) {
  console.error('Pemakaian: ts-node prisma/import-master.ts <path.xlsx> [--dry-run]');
  process.exit(1);
}

/**
 * Produk yang DIPENSIUNKAN oleh pemilik di backend (2026-07-06) — import tidak
 * boleh mengaktifkannya kembali. Shooting Package cukup tampil sebagai
 * bundle DS-BI-PU-0001 (duplikatnya di Items Code disembunyikan).
 */
const RETIRED_CODES = new Set(['DS-RT-PU-SP-0001']);

const TYPE_BY_UNIVERSAL: Record<string, ProductType> = {
  Rental: 'rental',
  Expendable: 'expendable',
  'Food & Beverage': 'catering',
  Crew: 'crew',
  Location: 'location',
};

interface ProductRow {
  code: string;
  name: string;
  type: ProductType;
  category_utama_code: string;
  sub_category_code: string;
  code_number: number;
  base_price: number;
  pricing_basis: PricingBasis;
  unit_label: string;
  min_qty: number | null;
  is_returnable: boolean;
  fixed_code: boolean;
}

function pad(n: number): string {
  return String(n).padStart(4, '0');
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Aturan turunan MIGRATION_PLAN §4 untuk field yang tidak ada di sheet. */
function derive(
  type: ProductType,
  sub_code: string,
): Pick<ProductRow, 'pricing_basis' | 'unit_label' | 'min_qty' | 'is_returnable'> {
  switch (type) {
    case 'rental':
      return { pricing_basis: 'per_day_unit', unit_label: 'unit', min_qty: null, is_returnable: true };
    case 'expendable':
      return { pricing_basis: 'per_unit', unit_label: 'unit', min_qty: null, is_returnable: false };
    case 'catering':
      // PC = Paket Catering (min 20 pax); SN/BV = paket snack/beverage per unit
      return sub_code === 'PC'
        ? { pricing_basis: 'per_package', unit_label: 'pax', min_qty: 20, is_returnable: false }
        : { pricing_basis: 'per_unit', unit_label: 'paket', min_qty: null, is_returnable: false };
    case 'crew':
      return { pricing_basis: 'per_person_day', unit_label: 'orang', min_qty: null, is_returnable: false };
    default:
      return { pricing_basis: 'per_day_unit', unit_label: 'unit', min_qty: null, is_returnable: true };
  }
}

function readSheet(wb: XLSX.WorkBook, name: string): unknown[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    defval: null,
    blankrows: false,
  });
  return rows.filter((r) => r.some((c) => c !== null && c !== ''));
}

function parseProducts(wb: XLSX.WorkBook): ProductRow[] {
  const rows = readSheet(wb, 'DuRent Items Code').slice(1); // buang header
  const out: ProductRow[] = [];
  for (const r of rows) {
    const name = toStr(r[0]);
    const universal = toStr(r[2]);
    const type = TYPE_BY_UNIVERSAL[universal];
    let code = toStr(r[10]);
    const code_number = Number(r[9] ?? 0);
    const base_price = Number(r[12] ?? 0);
    if (!name || !code || !type) continue;

    // Normalisasi bug sheet: kode tanpa akhiran 4 digit (mis. DS-CW-OT-DC)
    const fixed_code = !/-\d{4}$/.test(code);
    if (fixed_code) code = `${code}-${pad(code_number)}`;

    const sub_code = toStr(r[7]);
    out.push({
      code,
      name,
      type,
      category_utama_code: toStr(r[5]),
      sub_category_code: sub_code,
      code_number,
      base_price,
      ...derive(type, sub_code),
      fixed_code,
    });
  }
  return out;
}

interface BundleRow {
  code: string;
  name: string;
  type: ProductType;
  category_utama_code: string;
  code_number: number;
  bundle_price: number;
  items: Array<{ sku_name: string; sku_code: string; qty: number }>;
}

function parseBundles(wb: XLSX.WorkBook): BundleRow[] {
  const bundleRows = readSheet(wb, 'DuRent Bundling').slice(1);
  const itemRows = readSheet(wb, 'DuRent Bundling Code').slice(1);

  const bundles = new Map<string, BundleRow>();
  for (const r of bundleRows) {
    const code = toStr(r[8]);
    const cat = toStr(r[5]);
    if (!code) continue;
    bundles.set(code, {
      code,
      name: toStr(r[0]),
      // type diturunkan dari kategori komponen: CW = crew, lainnya rental
      type: cat === 'CW' ? 'crew' : 'rental',
      category_utama_code: cat,
      code_number: Number(r[7] ?? 0),
      bundle_price: 0, // diisi dari sheet Bundling Code (kolom Harga = harga bundle)
      items: [],
    });
  }
  for (const r of itemRows) {
    const bundleCode = toStr(r[1]);
    const b = bundles.get(bundleCode);
    if (!b) continue;
    b.items.push({
      sku_name: toStr(r[2]),
      sku_code: toStr(r[3]),
      qty: Number(r[4] ?? 0),
    });
    const harga = Number(r[6] ?? 0);
    if (harga > 0) b.bundle_price = harga;
  }
  return [...bundles.values()];
}

async function main(): Promise<void> {
  const wb = XLSX.readFile(xlsxPath);
  const products = parseProducts(wb);
  const bundles = parseBundles(wb);
  const priceByCode = new Map(products.map((p) => [p.code, p.base_price]));

  // ── Ringkasan / preview ──
  const byType = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Produk terbaca : ${products.length}  ${JSON.stringify(byType)}`);
  console.log(`Bundle terbaca : ${bundles.length}`);

  const fixed = products.filter((p) => p.fixed_code);
  if (fixed.length) {
    console.log('\nKode dinormalisasi (bug formula sheet):');
    fixed.forEach((p) => console.log(`  - ${p.name} → ${p.code}`));
  }

  const dupes = products.filter(
    (p, i) => products.findIndex((q) => q.code === p.code) !== i,
  );
  if (dupes.length) {
    console.log('\n⚠️ KODE DUPLIKAT (baris berikut akan menimpa yang pertama):');
    dupes.forEach((p) => console.log(`  - ${p.code} (${p.name})`));
  }

  console.log('\nBundle + harga:');
  for (const b of bundles) {
    const original = b.items.reduce(
      (s, it) => s + it.qty * (priceByCode.get(it.sku_code) ?? 0),
      0,
    );
    const missing = b.items.filter((it) => !priceByCode.has(it.sku_code));
    console.log(
      `  ${b.code}  ${b.name} — bundle_price=${b.bundle_price}, original_price=${original}` +
        (missing.length
          ? `  ⚠️ komponen tanpa produk: ${missing.map((m) => m.sku_code).join(', ')}`
          : ''),
    );
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Tidak ada yang ditulis ke database.');
    return;
  }

  // ── Tulis ke DB ──
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  });
  const prisma = new PrismaClient({ adapter });

  let pUpserted = 0;
  for (const p of products) {
    const { fixed_code: _fixed, ...data } = p;
    const is_active = !RETIRED_CODES.has(p.code);
    await prisma.product.upsert({
      where: { code: p.code },
      update: { ...data, is_active },
      create: { ...data, is_active },
    });
    pUpserted++;
  }

  let bUpserted = 0;
  for (const b of bundles) {
    const itemsData = await Promise.all(
      b.items.map(async (it) => {
        const product = await prisma.product.findUnique({
          where: { code: it.sku_code },
          select: { id: true, base_price: true },
        });
        return {
          product_id: product?.id ?? null,
          sku_name: it.sku_name,
          sku_code: it.sku_code,
          qty: it.qty,
          component_price: product?.base_price ?? 0,
        };
      }),
    );
    await prisma.$transaction(async (tx) => {
      const saved = await tx.bundle.upsert({
        where: { code: b.code },
        update: {
          name: b.name,
          type: b.type,
          category_utama_code: b.category_utama_code,
          code_number: b.code_number,
          bundle_price: b.bundle_price,
          is_active: true,
        },
        create: {
          code: b.code,
          name: b.name,
          type: b.type,
          category_utama_code: b.category_utama_code,
          code_number: b.code_number,
          bundle_price: b.bundle_price,
        },
      });
      await tx.bundleItem.deleteMany({ where: { bundle_id: saved.id } });
      await tx.bundleItem.createMany({
        data: itemsData.map((d) => ({ ...d, bundle_id: saved.id })),
      });
    });
    bUpserted++;
  }

  if (CLEAN_TEST) {
    const junkBundle = await prisma.bundle.findUnique({
      where: { code: 'DS-RT-CM-0001' },
      select: { id: true },
    });
    if (junkBundle) {
      await prisma.bundleItem.deleteMany({ where: { bundle_id: junkBundle.id } });
      await prisma.bundle.delete({ where: { id: junkBundle.id } });
      console.log('Data uji dihapus: bundle DS-RT-CM-0001');
    }
    const deleted = await prisma.voucher.deleteMany({
      where: { code: 'PROMO10' },
    });
    if (deleted.count) console.log('Data uji dihapus: voucher PROMO10');
  }

  console.log(`\nSelesai: ${pUpserted} produk & ${bUpserted} bundle di-upsert.`);
  console.log(
    `Total di DB: ${await prisma.product.count()} produk, ${await prisma.bundle.count()} bundle, ${await prisma.bundleItem.count()} komponen.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
