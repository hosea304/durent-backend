import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Order, Payment, Prisma } from '../../generated/prisma/client';
import { buildBilling, Billing } from './payment-status';
import { CreatePaymentDto } from './dto/payment.dto';

/** DATE kolom Prisma → 'YYYY-MM-DD'. */
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Bentuk baris ledger untuk respons — dipakai juga detail agregat order (D17). */
export function paymentRow(payment: Payment): Record<string, unknown> {
  return {
    id: payment.id,
    kind: payment.kind,
    amount: payment.amount,
    paid_date: dateOnly(payment.paid_date),
    note: payment.note,
    created_at: payment.created_at,
  };
}

/**
 * Ledger pembayaran per-ORDER (BUSINESS_FLOW §6, R5): dp → pelunasan → refund.
 * Setiap mutasi me-recompute `orders.status_pembayaran` dari seluruh ledger
 * (derivasi di payment-status.ts — satu sumber, dipakai juga detail order).
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tambah baris ledger + recompute status pembayaran (satu transaksi). */
  async addPayment(
    orderCode: string,
    dto: CreatePaymentDto,
  ): Promise<{ data: { payment: unknown; billing: Billing } }> {
    const order = await this.findOrderOrThrow(orderCode);

    // Order batal hanya boleh menerima REFUND (alur disposisi DP, D15/D26)
    if (order.status_transaksi === 'cancel' && dto.kind !== 'refund') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Order '${order.code}' sudah dibatalkan — hanya refund yang dapat dicatat`,
        details: [],
      });
    }

    const { payment, billing } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          order_id: order.id,
          kind: dto.kind,
          amount: dto.amount,
          paid_date: new Date(dto.paid_date),
          note: dto.note ?? null,
        },
      });

      const entries = await tx.payment.findMany({
        where: { order_id: order.id },
        select: { kind: true, amount: true },
      });
      const computed = buildBilling(
        await this.totalTagihan(tx, order),
        entries,
      );

      await tx.order.update({
        where: { id: order.id },
        data: { status_pembayaran: computed.status_pembayaran },
      });

      return { payment: created, billing: computed };
    });

    return {
      data: { payment: this.toPaymentResponse(payment), billing },
    };
  }

  /** Daftar ledger milik order — urut tanggal bayar lalu waktu input. */
  async listByOrder(orderCode: string): Promise<{ data: unknown[] }> {
    const order = await this.findOrderOrThrow(orderCode);
    const payments = await this.prisma.payment.findMany({
      where: { order_id: order.id },
      orderBy: [{ paid_date: 'asc' }, { created_at: 'asc' }],
    });
    return { data: payments.map((p) => this.toPaymentResponse(p)) };
  }

  /** Ringkas tagihan (API_CONTRACT §6). */
  async billing(orderCode: string): Promise<{ data: Billing }> {
    const order = await this.findOrderOrThrow(orderCode);
    const entries = await this.prisma.payment.findMany({
      where: { order_id: order.id },
      select: { kind: true, amount: true },
    });
    return {
      data: buildBilling(await this.totalTagihan(this.prisma, order), entries),
    };
  }

  /** total_tagihan = total_with_deposit + Σ denda (BUSINESS_FLOW §6, Tahap 5). */
  private async totalTagihan(
    db: PrismaService | Prisma.TransactionClient,
    order: Order,
  ): Promise<number> {
    const penalty = await db.penalty.findUnique({
      where: { order_id: order.id },
      select: { grand_total: true },
    });
    return order.total_with_deposit + (penalty?.grand_total ?? 0);
  }

  private async findOrderOrThrow(code: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { code } });
    if (!order) {
      throw new NotFoundException(`Order '${code}' tidak ditemukan`);
    }
    return order;
  }

  private toPaymentResponse(payment: Payment): Record<string, unknown> {
    return paymentRow(payment);
  }
}
