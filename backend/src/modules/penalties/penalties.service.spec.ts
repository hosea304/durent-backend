import { composePenaltyCode, computePenaltyTotals } from './penalties.service';
import { PenaltyItemInputDto } from './dto/penalty.dto';

/** Paritas rumus sheet Database Denda: `Denda Total = Qty × Denda per Qty`. */

const item = (
  over: Partial<PenaltyItemInputDto> = {},
): PenaltyItemInputDto => ({
  product_name: 'Handy Talky',
  product_code: 'DS-RT-CM-HT-0001',
  category: 'kerusakan',
  reason: 'Antena patah',
  qty: 2,
  denda_per_qty: 75_000,
  ...over,
});

describe('composePenaltyCode — kode order + "-D" (BUSINESS_FLOW §7)', () => {
  it('DR-230425-0001 → DR-230425-0001-D', () => {
    expect(composePenaltyCode('DR-230425-0001')).toBe('DR-230425-0001-D');
  });
});

describe('computePenaltyTotals — Denda Total = Qty × Denda per Qty', () => {
  it('per baris: 2 × 75.000 = 150.000', () => {
    const { rows } = computePenaltyTotals([item()]);
    expect(rows[0].denda_total).toBe(150_000);
    expect(rows[0].line_no).toBe(1);
  });

  it('grand total = Σ baris; overtime kru Rp50k/jam (D4)', () => {
    const { rows, grand_total } = computePenaltyTotals([
      item(), // 150.000
      item({
        product_name: 'Runner',
        product_code: 'DS-CW-RN-0001',
        category: 'overtime',
        reason: 'Lembur 3 jam',
        qty: 3,
        denda_per_qty: 50_000, // aturan overtime kru (D4)
      }), // 150.000
    ]);
    expect(rows[1].denda_total).toBe(150_000);
    expect(rows[1].line_no).toBe(2);
    expect(grand_total).toBe(300_000);
  });
});
