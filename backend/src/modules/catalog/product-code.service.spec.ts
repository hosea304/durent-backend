import { UnprocessableEntityException } from '@nestjs/common';
import {
  composeBundleCode,
  composeProductCode,
  padCodeNumber,
  ProductCodeService,
  UNIVERSAL_BY_TYPE,
} from './product-code.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('penyusun kode (fungsi murni)', () => {
  it('pad nomor urut jadi 4 digit', () => {
    expect(padCodeNumber(1)).toBe('0001');
    expect(padCodeNumber(42)).toBe('0042');
    expect(padCodeNumber(9999)).toBe('9999');
  });

  it('kode produk: BRAND-UNIVERSAL-CATUTAMA-SUB-NNNN', () => {
    expect(composeProductCode('rental', 'CM', 'HT', 1)).toBe(
      'DS-RT-CM-HT-0001',
    );
    expect(composeProductCode('catering', 'CT', 'PC', 3)).toBe(
      'DS-FB-CT-PC-0003',
    );
  });

  it('kode bundling: BRAND-BI-CATUTAMA-NNNN (BI konstan, tanpa sub)', () => {
    expect(composeBundleCode('CM', 1)).toBe('DS-BI-CM-0001');
    expect(composeBundleCode('PU', 4)).toBe('DS-BI-PU-0004');
  });

  it('mapping type → universal code sesuai MAPPING §1', () => {
    expect(UNIVERSAL_BY_TYPE.rental).toBe('RT');
    expect(UNIVERSAL_BY_TYPE.expendable).toBe('ED');
    expect(UNIVERSAL_BY_TYPE.catering).toBe('FB');
    expect(UNIVERSAL_BY_TYPE.crew).toBe('CW');
    expect(UNIVERSAL_BY_TYPE.location).toBe('LC');
  });
});

describe('ProductCodeService (prisma di-stub)', () => {
  // Stub minimal: segmen dianggap terdaftar, max code_number bisa diatur
  function makeService(maxNumber: number | null) {
    const prisma = {
      codeSegment: {
        findMany: jest
          .fn()
          .mockImplementation(
            (args: {
              where: { OR: Array<{ segment_type: string; code: string }> };
            }) =>
              Promise.resolve(
                args.where.OR.map((c) => ({
                  segment_type: c.segment_type,
                  code: c.code,
                })),
              ),
          ),
      },
      product: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { code_number: maxNumber } }),
      },
      bundle: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { code_number: maxNumber } }),
      },
    };
    return {
      service: new ProductCodeService(prisma as unknown as PrismaService),
      prisma,
    };
  }

  it('produk pertama untuk kombinasi segmen → 0001', async () => {
    const { service } = makeService(null);
    await expect(
      service.nextProductCode('rental', 'CM', 'HT'),
    ).resolves.toEqual({ code: 'DS-RT-CM-HT-0001', code_number: 1 });
  });

  it('nomor lanjut MAX+1 — nomor tak direuse meski produk nonaktif (D12)', async () => {
    const { service } = makeService(7);
    await expect(
      service.nextProductCode('expendable', 'EP', 'BT'),
    ).resolves.toEqual({ code: 'DS-ED-EP-BT-0008', code_number: 8 });
  });

  it('kode bundling lanjut MAX+1 per category utama (segmen BI)', async () => {
    const { service } = makeService(3);
    await expect(service.nextBundleCode('PU')).resolves.toEqual({
      code: 'DS-BI-PU-0004',
      code_number: 4,
    });
  });

  it('segmen tak terdaftar → 422 VALIDATION_FAILED', async () => {
    const { service, prisma } = makeService(null);
    prisma.codeSegment.findMany.mockResolvedValue([]); // tak ada segmen cocok
    await expect(
      service.nextProductCode('rental', 'XX', 'YY'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
