import { PaymentKind, PaymentStatus } from '../../generated/prisma/client';

/**
 * Derivasi status pembayaran dari ledger (DATA_MODEL §3.7 · D6/D26).
 * Aturan sheet (file finance): "Total Dibayar ≥ Total Tagihan → Lunas";
 * backend menambah status `sebagian` (FRONTEND_PREPARATION §4) dan default
 * `belum_lunas` (D6 — koreksi default "Lunas" sheet yang berisiko).
 *
 * total_tagihan = orders.total_with_deposit + Σ penalties.grand_total (Tahap 5).
 * Semua baris ledger bernilai POSITIF; refund DIKURANGKAN di sini.
 */

export interface LedgerEntry {
  kind: PaymentKind;
  amount: number;
}

/** Total dibayar bersih: Σ(dp + pelunasan) − Σ refund. */
export function totalPaid(entries: LedgerEntry[]): number {
  return entries.reduce(
    (sum, e) => (e.kind === 'refund' ? sum - e.amount : sum + e.amount),
    0,
  );
}

export function derivePaymentStatus(
  total_tagihan: number,
  total_paid: number,
): PaymentStatus {
  if (total_paid <= 0) return 'belum_lunas'; // default D6
  if (total_paid >= total_tagihan) return 'lunas'; // paritas aturan sheet
  return 'sebagian';
}

export interface Billing {
  total_tagihan: number;
  total_paid: number;
  outstanding: number; // bisa negatif bila kelebihan bayar (D26)
  status_pembayaran: PaymentStatus;
}

export function buildBilling(
  total_tagihan: number,
  entries: LedgerEntry[],
): Billing {
  const total_paid = totalPaid(entries);
  return {
    total_tagihan,
    total_paid,
    outstanding: total_tagihan - total_paid,
    status_pembayaran: derivePaymentStatus(total_tagihan, total_paid),
  };
}
