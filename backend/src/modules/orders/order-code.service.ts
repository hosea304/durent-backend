import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generator Kode Transaksi `DR-DDMMYY-NNNN-W` (D7/D30/KG3) — pengganti scan
 * kolom D yang rapuh di Apps Script `simpanDataInvoice()`.
 *
 * - DDMMYY  = tanggal order dibuat, zona WIB (UTC+7, tanpa DST) — bisnis di
 *   Indonesia; server bisa berjalan di UTC.
 * - NNNN    = nomor urut GLOBAL (tidak reset per hari/bulan), MAX+1 dari kolom
 *   `orders.code_number` — tanpa parsing string (pola D22 ③). Kode tak pernah
 *   direuse; unique constraint di `code` DAN `code_number` menjaga integritas
 *   saat ada request bersamaan (caller me-retry bila bentrok).
 * - `-W`     = penanda ORDER DARI WEBSITE (D30). Backend = kanal customer
 *   self-service yang jalan PARALEL dengan spreadsheet (admin manual). Suffix
 *   `-W` membuat kode website tak pernah tabrakan dengan kode spreadsheet →
 *   backend menomori dirinya sendiri mulai 0001, tanpa perlu tahu nomor sheet.
 */

export const ORDER_CODE_PREFIX = 'DR';
/** Penanda order dari website (D30) — dipisah agar mudah diuji/diubah. */
export const ORDER_CODE_SUFFIX = '-W';

/** Tanggal "hari ini" dalam WIB → { datePart: 'DDMMYY', isoDate: 'YYYY-MM-DD' }. */
export function wibToday(now: Date = new Date()): {
  datePart: string;
  isoDate: string;
} {
  const wib = new Date(now.getTime() + 7 * 3_600_000);
  const dd = String(wib.getUTCDate()).padStart(2, '0');
  const mm = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(wib.getUTCFullYear());
  return {
    datePart: `${dd}${mm}${yyyy.slice(-2)}`,
    isoDate: `${yyyy}-${mm}-${dd}`,
  };
}

export function composeOrderCode(
  datePart: string,
  code_number: number,
): string {
  return `${ORDER_CODE_PREFIX}-${datePart}-${String(code_number).padStart(4, '0')}${ORDER_CODE_SUFFIX}`;
}

@Injectable()
export class OrderCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kode order berikutnya: `MAX(code_number)+1` global (semua baris,
   * aktif/cancel), diberi suffix `-W`. Ruang nomor website independen dari
   * spreadsheet (D30) → mulai 0001 tanpa koordinasi nomor sheet.
   */
  async nextOrderCode(now: Date = new Date()): Promise<{
    code: string;
    code_number: number;
    invoice_date: string; // YYYY-MM-DD (WIB)
  }> {
    const max = await this.prisma.order.aggregate({
      _max: { code_number: true },
    });
    const code_number = (max._max.code_number ?? 0) + 1;
    const { datePart, isoDate } = wibToday(now);
    return {
      code: composeOrderCode(datePart, code_number),
      code_number,
      invoice_date: isoDate,
    };
  }
}
