import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductType, SegmentType } from '../../generated/prisma/client';

/**
 * Penyusun kode produk/bundling (D12/KG3) — pengganti kolom "auto" di sheet
 * DuRent Items Code / DuRent Bundling.
 *
 * Produk : {BRAND}-{UNIVERSAL}-{CAT_UTAMA}-{SUB}-{NNNN}  → DS-RT-CM-HT-0001
 * Bundle : {BRAND}-BI-{CAT_UTAMA}-{NNNN}                 → DS-BI-CM-0001
 *          (BI = "Bundling Items", segmen konstan sesuai sheet DuRent Bundling;
 *           nomor urut per category utama)
 *
 * NNNN = nomor urut per kombinasi segmen (MAX+1), pembeda tipe sama beda merek.
 * Kode bersifat immutable & tidak pernah direuse — soft delete tidak
 * membebaskan nomor (MAX dihitung dari SEMUA baris, aktif maupun tidak).
 */

export const BRAND_CODE = 'DS';

/** Segmen universal khusus bundling (sheet: "Bundling Items"). */
export const BUNDLE_UNIVERSAL_CODE = 'BI';

/** type produk ↔ kode Universal Category (MAPPING §1: RT/ED/FB/CW/LC). */
export const UNIVERSAL_BY_TYPE: Record<ProductType, string> = {
  rental: 'RT',
  expendable: 'ED',
  catering: 'FB',
  crew: 'CW',
  location: 'LC',
};

export function padCodeNumber(n: number): string {
  return String(n).padStart(4, '0');
}

export function composeProductCode(
  type: ProductType,
  category_utama_code: string,
  sub_category_code: string,
  code_number: number,
): string {
  return [
    BRAND_CODE,
    UNIVERSAL_BY_TYPE[type],
    category_utama_code,
    sub_category_code,
    padCodeNumber(code_number),
  ].join('-');
}

export function composeBundleCode(
  category_utama_code: string,
  code_number: number,
): string {
  return [
    BRAND_CODE,
    BUNDLE_UNIVERSAL_CODE,
    category_utama_code,
    padCodeNumber(code_number),
  ].join('-');
}

@Injectable()
export class ProductCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kode produk berikutnya untuk kombinasi segmen. */
  async nextProductCode(
    type: ProductType,
    category_utama_code: string,
    sub_category_code: string,
  ): Promise<{ code: string; code_number: number }> {
    await this.ensureSegmentsValid(
      type,
      category_utama_code,
      sub_category_code,
    );

    const max = await this.prisma.product.aggregate({
      _max: { code_number: true },
      where: { type, category_utama_code, sub_category_code },
    });
    const code_number = (max._max.code_number ?? 0) + 1;
    return {
      code: composeProductCode(
        type,
        category_utama_code,
        sub_category_code,
        code_number,
      ),
      code_number,
    };
  }

  /** Kode bundling berikutnya: DS-BI-{CAT}-{NNNN}, nomor per category utama. */
  async nextBundleCode(
    category_utama_code: string,
  ): Promise<{ code: string; code_number: number }> {
    await this.ensureBundleSegmentsValid(category_utama_code);

    const max = await this.prisma.bundle.aggregate({
      _max: { code_number: true },
      where: { category_utama_code },
    });
    const code_number = (max._max.code_number ?? 0) + 1;
    return {
      code: composeBundleCode(category_utama_code, code_number),
      code_number,
    };
  }

  /** Pastikan segmen terdaftar & aktif di code_segments (kamus Master Data Item). */
  private async ensureSegmentsValid(
    type: ProductType,
    category_utama_code: string,
    sub_category_code: string | null,
  ): Promise<void> {
    const checks: Array<{ segment_type: SegmentType; code: string }> = [
      { segment_type: 'universal', code: UNIVERSAL_BY_TYPE[type] },
      { segment_type: 'category_utama', code: category_utama_code },
    ];
    if (sub_category_code !== null) {
      checks.push({ segment_type: 'sub_category', code: sub_category_code });
    }
    await this.ensureChecksExist(checks);
  }

  private async ensureBundleSegmentsValid(
    category_utama_code: string,
  ): Promise<void> {
    await this.ensureChecksExist([
      { segment_type: 'universal', code: BUNDLE_UNIVERSAL_CODE },
      { segment_type: 'category_utama', code: category_utama_code },
    ]);
  }

  private async ensureChecksExist(
    checks: Array<{ segment_type: SegmentType; code: string }>,
  ): Promise<void> {
    const found = await this.prisma.codeSegment.findMany({
      where: { is_active: true, OR: checks },
      select: { segment_type: true, code: true },
    });

    const missing = checks.filter(
      (c) =>
        !found.some(
          (f) => f.segment_type === c.segment_type && f.code === c.code,
        ),
    );
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Segmen kode tidak dikenal atau nonaktif',
        details: missing.map(
          (m) => `${m.segment_type}: '${m.code}' tidak ada di code_segments`,
        ),
      });
    }
  }
}
