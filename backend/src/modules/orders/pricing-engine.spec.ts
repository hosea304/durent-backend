import {
  durationDays,
  priceItem,
  priceOrder,
  PricingItemInput,
} from './pricing-engine';

/**
 * Uji PARITAS vs formula sheet Database Penyewaan (MG2/KG2).
 * Setiap angka harapan dihitung manual dari rumus di
 * CURRENT_SPREADSHEET_STRUCTURE §5 / BUSINESS_FLOW §9.
 */

const item = (over: Partial<PricingItemInput> = {}): PricingItemInput => ({
  start_date: '2026-07-10',
  end_date: '2026-07-11',
  qty: 20,
  unit_price: 5000,
  is_discount: false,
  ...over,
});

describe('durationDays — Durasi = (Selesai − Mulai) + 1, inklusif', () => {
  it('hari yang sama = 1 hari', () => {
    expect(durationDays('2026-07-10', '2026-07-10')).toBe(1);
  });

  it('10 → 11 Juli = 2 hari', () => {
    expect(durationDays('2026-07-10', '2026-07-11')).toBe(2);
  });

  it('lintas bulan: 30 Jun → 2 Jul = 3 hari', () => {
    expect(durationDays('2026-06-30', '2026-07-02')).toBe(3);
  });

  it('lintas tahun: 31 Des → 1 Jan = 2 hari', () => {
    expect(durationDays('2026-12-31', '2027-01-01')).toBe(2);
  });
});

describe('priceItem — Amount, Rental Total, Sub Total (kolom M/O/T)', () => {
  it('contoh API_CONTRACT §5.0: Kursi 20×5000, 2 hari', () => {
    const priced = priceItem(item(), null);
    expect(priced).toEqual({
      duration: 2,
      amount: 100_000, // 20 × 5.000
      rental_total: 200_000, // 2 × 100.000
      discount_percent: null,
      discount_amount: null,
      sub_total: 200_000,
    });
  });

  it('diskon persen: Rental − (Rental × %) — 10% dari 200.000', () => {
    const priced = priceItem(item({ is_discount: true }), {
      type: 'percent',
      value: 10,
    });
    expect(priced.sub_total).toBe(180_000);
    expect(priced.discount_percent).toBe(10);
    expect(priced.discount_amount).toBeNull();
  });

  it('diskon nominal: Rental − nominal — 25.000 dari 200.000', () => {
    const priced = priceItem(item({ is_discount: true }), {
      type: 'nominal',
      value: 25_000,
    });
    expect(priced.sub_total).toBe(175_000);
    expect(priced.discount_percent).toBeNull();
    expect(priced.discount_amount).toBe(25_000);
  });

  it('baris TANPA checkbox diskon tidak kena voucher (D13: per-baris)', () => {
    const priced = priceItem(item({ is_discount: false }), {
      type: 'percent',
      value: 10,
    });
    expect(priced.sub_total).toBe(200_000);
    expect(priced.discount_percent).toBeNull();
  });

  it('checkbox diskon TANPA voucher = tanpa diskon (paritas XLOOKUP kosong)', () => {
    const priced = priceItem(item({ is_discount: true }), null);
    expect(priced.sub_total).toBe(200_000);
  });

  it('persen pecahan dibulatkan Math.round: 15% × 33.333 → 5.000', () => {
    // rental = 1 hari × 1 × 33.333 = 33.333; 15% = 4.999,95 → 5.000
    const priced = priceItem(
      item({
        end_date: '2026-07-10',
        qty: 1,
        unit_price: 33_333,
        is_discount: true,
      }),
      { type: 'percent', value: 15 },
    );
    expect(priced.sub_total).toBe(28_333);
  });
});

describe('priceOrder — Grand Total, Deposit, Total+Deposit (kolom U/W/X)', () => {
  // Skenario multi-item ala order asli: kursi + catering + crew
  const items: PricingItemInput[] = [
    // Kursi: 2 hari × (20 × 5.000) = 200.000
    item(),
    // Catering: 1 hari × (60 × 10.000) = 600.000 (same-day)
    item({
      end_date: '2026-07-10',
      qty: 60,
      unit_price: 10_000,
    }),
    // Crew: 2 hari × (1 × 50.000) = 100.000
    item({ qty: 1, unit_price: 50_000 }),
  ];

  it('contoh API_CONTRACT §5.0: grand 900.000 · deposit 50% = 450.000 · total 1.350.000', () => {
    const priced = priceOrder(items, null, 50);
    expect(priced.grand_total).toBe(900_000);
    expect(priced.deposit_amount).toBe(450_000);
    expect(priced.total_with_deposit).toBe(1_350_000);
  });

  it('deposit dihitung dari Σ Rental Total PRA-diskon (sheet: SUM(O) × V)', () => {
    // Kursi didiskon 50% → sub_total 100.000; grand = 100k + 600k + 100k = 800k
    // Deposit 10% tetap dari 900.000 (pra-diskon) = 90.000, BUKAN dari 800.000
    const discounted = [items[0], items[1], items[2]].map((it, i) =>
      i === 0 ? { ...it, is_discount: true } : it,
    );
    const priced = priceOrder(discounted, { type: 'percent', value: 50 }, 10);
    expect(priced.grand_total).toBe(800_000);
    expect(priced.deposit_amount).toBe(90_000);
    expect(priced.total_with_deposit).toBe(890_000);
  });

  it('deposit 0% → deposit_amount 0, total = grand total', () => {
    const priced = priceOrder(items, null, 0);
    expect(priced.deposit_amount).toBe(0);
    expect(priced.total_with_deposit).toBe(priced.grand_total);
  });

  it('order kosong = semua nol (guard, bukan kasus sheet)', () => {
    const priced = priceOrder([], null, 50);
    expect(priced.grand_total).toBe(0);
    expect(priced.deposit_amount).toBe(0);
    expect(priced.total_with_deposit).toBe(0);
  });

  it('diskon nominal per-baris hanya mengurangi baris itu', () => {
    const withNominal = items.map((it, i) =>
      i === 2 ? { ...it, is_discount: true } : it,
    );
    const priced = priceOrder(
      withNominal,
      { type: 'nominal', value: 30_000 },
      0,
    );
    // crew 100.000 − 30.000 = 70.000 → grand = 200k + 600k + 70k
    expect(priced.items[2].sub_total).toBe(70_000);
    expect(priced.grand_total).toBe(870_000);
  });
});
