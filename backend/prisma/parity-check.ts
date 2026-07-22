/**
 * Uji PARITAS Pricing Engine vs Spreadsheet (MIGRATION_PLAN §6.1 — GATE go-live).
 *
 * Ambil beberapa order NYATA dari sheet Database Penyewaan, tulis input + total
 * versi sheet ke file JSON, lalu jalankan:
 *
 *     npm run parity                         # baca prisma/parity-samples.json
 *     npm run parity -- path/lain.json       # file lain
 *
 * Script memanggil Pricing Engine (fungsi murni, tanpa DB) dengan input yang
 * sama dan membandingkan hasilnya dengan angka sheet. **Semua harus identik.**
 * Exit code 1 bila ada yang beda → cocok dipakai sebagai gate CI/manual.
 *
 * Template: `prisma/parity-samples.example.json` (jalankan dulu untuk lihat
 * bentuk laporannya: `npm run parity -- prisma/parity-samples.example.json`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  priceOrder,
  PricingItemInput,
  PricingVoucher,
} from '../src/modules/orders/pricing-engine';

/** Satu order historis dari sheet + total yang diharapkan. */
interface ParitySample {
  ref: string; // pengenal, mis. kode order sheet "DR-230425-0001"
  deposit_percent: number;
  voucher: PricingVoucher | null;
  items: PricingItemInput[];
  expected: {
    grand_total: number;
    deposit_amount: number;
    total_with_deposit: number;
    sub_totals?: number[]; // opsional: sub_total per baris (urut sama dgn items)
  };
}

interface Mismatch {
  field: string;
  got: number;
  expected: number;
}

function checkSample(s: ParitySample): Mismatch[] {
  const priced = priceOrder(s.items, s.voucher, s.deposit_percent);
  const diffs: Mismatch[] = [];

  const cmp = (field: string, got: number, expected: number): void => {
    if (got !== expected) diffs.push({ field, got, expected });
  };

  cmp('grand_total', priced.grand_total, s.expected.grand_total);
  cmp('deposit_amount', priced.deposit_amount, s.expected.deposit_amount);
  cmp(
    'total_with_deposit',
    priced.total_with_deposit,
    s.expected.total_with_deposit,
  );

  if (s.expected.sub_totals) {
    if (s.expected.sub_totals.length !== priced.items.length) {
      diffs.push({
        field: 'sub_totals.length',
        got: priced.items.length,
        expected: s.expected.sub_totals.length,
      });
    } else {
      s.expected.sub_totals.forEach((exp, i) => {
        cmp(`items[${i}].sub_total`, priced.items[i].sub_total, exp);
      });
    }
  }

  return diffs;
}

function rupiah(n: number): string {
  return n.toLocaleString('id-ID');
}

function main(): void {
  const file = process.argv[2] ?? 'prisma/parity-samples.json';
  const path = resolve(process.cwd(), file);

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error(`✖ File sampel tidak ditemukan: ${path}`);
    console.error(
      '  Salin prisma/parity-samples.example.json → prisma/parity-samples.json,',
    );
    console.error('  isi dengan order NYATA dari sheet, lalu jalankan lagi.');
    process.exit(1);
  }

  const parsed = JSON.parse(raw) as { samples?: ParitySample[] };
  const samples = parsed.samples ?? [];
  if (samples.length === 0) {
    console.error('✖ Tidak ada sampel di file (properti "samples" kosong).');
    process.exit(1);
  }

  console.log(`\nUji paritas Pricing Engine vs sheet — ${samples.length} order`);
  console.log(`Sumber: ${path}\n`);

  let failed = 0;
  for (const s of samples) {
    const diffs = checkSample(s);
    if (diffs.length === 0) {
      console.log(`  ✓ PASS  ${s.ref}`);
    } else {
      failed++;
      console.log(`  ✖ FAIL  ${s.ref}`);
      for (const d of diffs) {
        console.log(
          `          ${d.field}: backend ${rupiah(d.got)} ≠ sheet ${rupiah(d.expected)}`,
        );
      }
    }
  }

  const passed = samples.length - failed;
  console.log(`\n${passed}/${samples.length} identik.`);
  if (failed > 0) {
    console.log(
      `${failed} order BEDA — jangan cutover sampai selisih dijelaskan/diperbaiki (gate MG2).\n`,
    );
    process.exit(1);
  }
  console.log('Gate paritas LULUS ✅\n');
}

main();
