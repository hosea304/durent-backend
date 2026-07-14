import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Adapter WhatsApp (BACKEND_ARCHITECTURE: integrasi via adapter, D16).
 * MVP: hanya MEMBENTUK URL `wa.me` ke admin — order diarahkan ke WA admin
 * dulu (BUSINESS_FLOW §2 TO-BE); kirim-otomatis/payment gateway = Future.
 */
@Injectable()
export class WhatsappAdapter {
  constructor(private readonly config: ConfigService) {}

  /**
   * URL "Chat Admin" untuk respons POST /orders (`whatsapp_admin_url`).
   * Null bila ADMIN_WA_NUMBER belum di-set (FE menyembunyikan tombol).
   */
  adminOrderUrl(orderCode: string, customerName: string): string | null {
    const raw = this.config.get<string>('ADMIN_WA_NUMBER');
    if (!raw) return null;

    // wa.me menuntut nomor internasional tanpa tanda: 08xx → 628xx
    const digits = raw.replace(/\D/g, '');
    const number = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;

    const text =
      `Halo Admin DuRent, saya ${customerName}. ` +
      `Order ${orderCode} sudah saya buat — mohon konfirmasi ketersediaan.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }
}
