/**
 * Import vouchers dari file "Operasional DuRent (invoice)" —
 * sheet "Voucher Data & Settings" (MIGRATION_PLAN Tahap 2).
 *
 * Pakai: npx ts-node prisma/import-vouchers.ts <path.xlsx> [--dry-run]
 *
 * - Idempotent (upsert by code). Kode disimpan APA ADANYA (case & spasi
 *   dipertahankan — kode ini sudah beredar ke customer).
 * - Persen di sheet berupa pecahan (0.2 = 20%) → disimpan 20.
 * - Nominal berupa teks "Rp50,000" → disimpan integer 50000.
 */
import 'dotenv/config';
import * as XLSX from 'xlsx';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, VoucherType } from '../src/generated/prisma/client';

const xlsxPath = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');

if (!xlsxPath) {
  console.error('Pemakaian: ts-node prisma/import-vouchers.ts <path.xlsx> [--dry-run]');
  process.exit(1);
}

interface VoucherRow {
  code: string;
  type: VoucherType;
  value: number;
}

function parseNominal(v: unknown): number {
  return Number(String(v).replace(/[^\d]/g, ''));
}

function main(): VoucherRow[] {
  const wb = XLSX.readFile(xlsxPath);
  const rows = XLSX.utils
    .sheet_to_json<unknown[]>(wb.Sheets['Voucher Data & Settings'], {
      header: 1,
      defval: null,
      blankrows: false,
    })
    .filter((r) => r.some((c) => c !== null && c !== ''));

  const out: VoucherRow[] = [];
  for (const r of rows) {
    const code = r[0] === null || r[0] === undefined ? '' : String(r[0]).trim();
    // lewati judul & header
    if (!code || code === 'Voucher Data' || code === 'Voucher Code') continue;

    const percent = r[1];
    const nominal = r[2];
    if (percent !== null && percent !== undefined && percent !== '') {
      out.push({ code, type: 'percent', value: Math.round(Number(percent) * 100) });
    } else if (nominal !== null && nominal !== undefined && nominal !== '') {
      out.push({ code, type: 'nominal', value: parseNominal(nominal) });
    }
  }
  return out;
}

async function run(): Promise<void> {
  const vouchers = main();
  console.log(`Voucher terbaca: ${vouchers.length}`);
  vouchers.forEach((v) =>
    console.log(`  ${v.code} → ${v.type} ${v.value}${v.type === 'percent' ? '%' : ''}`),
  );

  if (DRY_RUN) {
    console.log('\n[dry-run] Tidak ada yang ditulis ke database.');
    return;
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  });
  const prisma = new PrismaClient({ adapter });
  for (const v of vouchers) {
    await prisma.voucher.upsert({
      where: { code: v.code },
      update: { type: v.type, value: v.value, is_active: true },
      create: v,
    });
  }
  console.log(`\nSelesai: ${vouchers.length} voucher di-upsert. Total di DB: ${await prisma.voucher.count()}.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
