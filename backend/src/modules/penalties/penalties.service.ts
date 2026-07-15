import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Order, Penalty, PenaltyItem } from '../../generated/prisma/client';
import { wibToday } from '../orders/order-code.service';
import {
  buildBilling,
  derivePaymentStatus,
  totalPaid,
} from '../payments/payment-status';
import { CreatePenaltyDto, PenaltyItemInputDto } from './dto/penalty.dto';

/** Akhiran kode denda: `DR-DDMMYY-NNNN` + `-D` (BUSINESS_FLOW §7). */
export const PENALTY_CODE_SUFFIX = '-D';

export function composePenaltyCode(orderCode: string): string {
  return `${orderCode}${PENALTY_CODE_SUFFIX}`;
}

/** Hitung baris & grand total denda — `Denda Total = Qty × Denda per Qty`. */
export function computePenaltyTotals(items: PenaltyItemInputDto[]): {
  rows: Array<PenaltyItemInputDto & { denda_total: number; line_no: number }>;
  grand_total: number;
} {
  const rows = items.map((item, i) => ({
    ...item,
    line_no: i + 1,
    denda_total: item.qty * item.denda_per_qty,
  }));
  return {
    rows,
    grand_total: rows.reduce((sum, r) => sum + r.denda_total, 0),
  };
}

type PenaltyWithItems = Penalty & { items: PenaltyItem[] };

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Bentuk respons denda — status_transaksi/status_pembayaran DERIVED dari order
 * (paritas lookup sheet Database Denda; tidak disimpan ganda — D27).
 */
export function penaltyRow(
  penalty: PenaltyWithItems,
  order: Order,
): Record<string, unknown> {
  return {
    code: penalty.code,
    order_code: order.code,
    invoice_date: dateOnly(penalty.invoice_date),
    items: [...penalty.items]
      .sort((a, b) => a.line_no - b.line_no)
      .map((item) => ({
        line_no: item.line_no,
        product_name: item.product_name,
        product_code: item.product_code,
        category: item.category,
        reason: item.reason,
        qty: item.qty,
        denda_per_qty: item.denda_per_qty,
        denda_total: item.denda_total,
      })),
    grand_total: penalty.grand_total,
    status_transaksi: order.status_transaksi,
    status_pembayaran: order.status_pembayaran,
    created_at: penalty.created_at,
    updated_at: penalty.updated_at,
  };
}

@Injectable()
export class PenaltiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Buat denda `-D` (SATU per order, D14) — dihitung setelah periode selesai.
   * Menambah total_tagihan → status pembayaran order diturunkan ulang
   * dalam transaksi yang sama.
   */
  async create(
    orderCode: string,
    dto: CreatePenaltyDto,
  ): Promise<{ data: unknown }> {
    const order = await this.findOrderOrThrow(orderCode);

    if (order.status_transaksi === 'cancel') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Order '${order.code}' sudah dibatalkan — tidak bisa diberi denda`,
        details: [],
      });
    }
    const existing = await this.prisma.penalty.findUnique({
      where: { order_id: order.id },
      select: { code: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Denda '${existing.code}' sudah ada — satu denda per order (D14)`,
        details: [],
      });
    }

    const { rows, grand_total } = computePenaltyTotals(dto.items);

    const { penalty, orderAfter } = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.penalty.create({
          data: {
            code: composePenaltyCode(order.code),
            order_id: order.id,
            invoice_date: new Date(wibToday().isoDate),
            grand_total,
            items: {
              create: rows.map((r) => ({
                line_no: r.line_no,
                product_name: r.product_name,
                product_code: r.product_code,
                category: r.category,
                reason: r.reason,
                qty: r.qty,
                denda_per_qty: r.denda_per_qty,
                denda_total: r.denda_total,
              })),
            },
          },
          include: { items: true },
        });

        // total_tagihan bertambah → order bisa turun dari lunas ke sebagian
        const ledger = await tx.payment.findMany({
          where: { order_id: order.id },
          select: { kind: true, amount: true },
        });
        const status_pembayaran = derivePaymentStatus(
          order.total_with_deposit + grand_total,
          totalPaid(ledger),
        );
        const updated = await tx.order.update({
          where: { id: order.id },
          data: { status_pembayaran },
        });

        return { penalty: created, orderAfter: updated };
      },
    );

    return { data: penaltyRow(penalty, orderAfter) };
  }

  /** Denda milik order — array 0/1 elemen (konsisten dengan agregat detail). */
  async byOrder(orderCode: string): Promise<{ data: unknown[] }> {
    const order = await this.findOrderOrThrow(orderCode);
    const penalty = await this.prisma.penalty.findUnique({
      where: { order_id: order.id },
      include: { items: true },
    });
    return { data: penalty ? [penaltyRow(penalty, order)] : [] };
  }

  /** Detail denda by kode `…-D` + ringkas billing order induk. */
  async byCode(penaltyCode: string): Promise<{ data: unknown }> {
    const penalty = await this.prisma.penalty.findUnique({
      where: { code: penaltyCode },
      include: { items: true, order: true },
    });
    if (!penalty) {
      throw new NotFoundException(`Denda '${penaltyCode}' tidak ditemukan`);
    }
    const ledger = await this.prisma.payment.findMany({
      where: { order_id: penalty.order_id },
      select: { kind: true, amount: true },
    });
    return {
      data: {
        ...penaltyRow(penalty, penalty.order),
        billing: buildBilling(
          penalty.order.total_with_deposit + penalty.grand_total,
          ledger,
        ),
      },
    };
  }

  private async findOrderOrThrow(code: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { code } });
    if (!order) {
      throw new NotFoundException(`Order '${code}' tidak ditemukan`);
    }
    return order;
  }
}
