import { VoucherType } from '../../generated/prisma/client';

/**
 * Pricing Engine (KG2/D16) — SATU-SATUNYA tempat kalkulasi uang order.
 * Mereplikasi persis formula sheet Database Penyewaan
 * (CURRENT_SPREADSHEET_STRUCTURE §5 · BUSINESS_FLOW §9):
 *
 *   Durasi        = (Selesai − Mulai) + 1   — inklusif, hari sama = 1
 *   Amount        = Qty × Unit Price
 *   Rental Total  = Durasi × Amount
 *   Sub Total     = persen  → Rental − (Rental × %)
 *                   nominal → Rental − nominal
 *                   (hanya baris ber-checkbox diskon DAN ada voucher — paritas
 *                    XLOOKUP kode promo: tanpa voucher, diskon tidak terjadi)
 *   Grand Total   = Σ Sub Total
 *   Deposit       = Σ Rental Total × Deposit%   — basis PRA-diskon (D5)
 *   Total+Deposit = Grand Total + Deposit
 *
 * Uang = integer rupiah; hasil persen yang pecahan dibulatkan Math.round
 * (sheet menyimpan desimal — selisih maksimal Rp1 dicatat di D25).
 * Murni fungsi (tanpa DB/IO) supaya mudah diuji paritas vs sheet (MG2).
 */

export interface PricingVoucher {
  type: VoucherType; // percent | nominal
  value: number; // percent: 0–100 · nominal: rupiah
}

export interface PricingItemInput {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  qty: number;
  unit_price: number; // snapshot harga katalog
  is_discount: boolean;
}

export interface PricedItem {
  duration: number;
  amount: number;
  rental_total: number;
  discount_percent: number | null; // snapshot nilai voucher percent
  discount_amount: number | null; // snapshot nilai voucher nominal
  sub_total: number;
}

export interface PricedOrder {
  items: PricedItem[];
  grand_total: number;
  deposit_amount: number;
  total_with_deposit: number;
}

const MS_PER_DAY = 86_400_000;

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Durasi inklusif dalam hari: (end − start) + 1. Tanggal ISO `YYYY-MM-DD`. */
export function durationDays(start_date: string, end_date: string): number {
  return (
    Math.round((isoToUtcMs(end_date) - isoToUtcMs(start_date)) / MS_PER_DAY) + 1
  );
}

/** Hitung satu baris item persis kolom M/N/O/T sheet. */
export function priceItem(
  item: PricingItemInput,
  voucher: PricingVoucher | null,
): PricedItem {
  const duration = durationDays(item.start_date, item.end_date);
  const amount = item.qty * item.unit_price;
  const rental_total = duration * amount;

  let discount_percent: number | null = null;
  let discount_amount: number | null = null;
  let sub_total = rental_total;

  if (item.is_discount && voucher) {
    if (voucher.type === 'percent') {
      discount_percent = voucher.value;
      sub_total =
        rental_total - Math.round((rental_total * voucher.value) / 100);
    } else {
      discount_amount = voucher.value;
      sub_total = rental_total - voucher.value;
    }
  }

  return {
    duration,
    amount,
    rental_total,
    discount_percent,
    discount_amount,
    sub_total,
  };
}

/** Hitung seluruh order (baris + total header U/W/X sheet). */
export function priceOrder(
  items: PricingItemInput[],
  voucher: PricingVoucher | null,
  deposit_percent: number,
): PricedOrder {
  const priced = items.map((item) => priceItem(item, voucher));

  const grand_total = priced.reduce((sum, i) => sum + i.sub_total, 0);
  // Deposit atas dasar PRA-diskon: SUM(Rental Total) × Deposit% (sheet kolom W)
  const rentalSum = priced.reduce((sum, i) => sum + i.rental_total, 0);
  const deposit_amount = Math.round((rentalSum * deposit_percent) / 100);

  return {
    items: priced,
    grand_total,
    deposit_amount,
    total_with_deposit: grand_total + deposit_amount,
  };
}
