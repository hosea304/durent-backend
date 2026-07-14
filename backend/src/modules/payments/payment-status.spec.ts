import {
  buildBilling,
  derivePaymentStatus,
  LedgerEntry,
  totalPaid,
} from './payment-status';

/**
 * Uji paritas aturan file finance (CURRENT_SPREADSHEET_STRUCTURE §5):
 * "Total Dibayar ≥ Total Tagihan → Lunas" + koreksi default belum_lunas (D6).
 */

const entry = (kind: LedgerEntry['kind'], amount: number): LedgerEntry => ({
  kind,
  amount,
});

describe('totalPaid — Σ(dp+pelunasan) − Σ refund', () => {
  it('ledger kosong = 0', () => {
    expect(totalPaid([])).toBe(0);
  });

  it('dp + pelunasan dijumlahkan', () => {
    expect(totalPaid([entry('dp', 450_000), entry('pelunasan', 900_000)])).toBe(
      1_350_000,
    );
  });

  it('refund dikurangkan (disimpan positif — D26)', () => {
    expect(totalPaid([entry('dp', 450_000), entry('refund', 450_000)])).toBe(0);
  });
});

describe('derivePaymentStatus — default belum_lunas (D6)', () => {
  it('belum bayar → belum_lunas (koreksi default "Lunas" sheet)', () => {
    expect(derivePaymentStatus(1_350_000, 0)).toBe('belum_lunas');
  });

  it('bayar sebagian → sebagian', () => {
    expect(derivePaymentStatus(1_350_000, 450_000)).toBe('sebagian');
  });

  it('paritas sheet: dibayar ≥ tagihan → lunas (tepat)', () => {
    expect(derivePaymentStatus(1_350_000, 1_350_000)).toBe('lunas');
  });

  it('kelebihan bayar tetap lunas', () => {
    expect(derivePaymentStatus(1_350_000, 1_500_000)).toBe('lunas');
  });

  it('refund penuh mengembalikan ke belum_lunas', () => {
    expect(derivePaymentStatus(1_350_000, -100)).toBe('belum_lunas');
  });
});

describe('buildBilling — bentuk respons GET /orders/{code}/billing', () => {
  it('outstanding = tagihan − dibayar; status ikut derivasi', () => {
    const billing = buildBilling(1_350_000, [entry('dp', 450_000)]);
    expect(billing).toEqual({
      total_tagihan: 1_350_000,
      total_paid: 450_000,
      outstanding: 900_000,
      status_pembayaran: 'sebagian',
    });
  });

  it('kelebihan bayar → outstanding negatif (informasi FE, D26)', () => {
    const billing = buildBilling(100_000, [entry('pelunasan', 150_000)]);
    expect(billing.outstanding).toBe(-50_000);
    expect(billing.status_pembayaran).toBe('lunas');
  });
});
