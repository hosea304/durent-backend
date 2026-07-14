import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CatalogType,
  DeliverySlot,
  Order,
  OrderItem,
  Prisma,
  Voucher,
} from '../../generated/prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ListResponse, listResponse } from '../../common/utils/list-response';
import { WhatsappAdapter } from '../integrations/whatsapp.adapter';
import { OrderCodeService } from './order-code.service';
import {
  durationDays,
  PricedOrder,
  priceOrder,
  PricingItemInput,
  PricingVoucher,
} from './pricing-engine';
import {
  CancelOrderDto,
  ChangeStatusDto,
  CreateOrderDto,
  OrderItemInputDto,
  OrderListQueryDto,
  OrderLookupQueryDto,
  UpdateOrderDto,
} from './dto/order.dto';

/** Baris keranjang yang sudah tervalidasi + harga SNAPSHOT dari katalog (R3). */
interface ResolvedItem {
  catalog_type: CatalogType;
  product_id: string | null;
  bundle_id: string | null;
  item_name: string;
  item_code: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  qty: number;
  unit_price: number;
  is_discount: boolean;
  delivery_slot: DeliverySlot | null;
}

type OrderWithItems = Order & { items: OrderItem[] };

/** DATE kolom Prisma → 'YYYY-MM-DD' (API_CONTRACT §1: tanggal ISO). */
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Samakan format telepon untuk pencocokan lookup: buang non-digit, 08… → 628…. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

const CREATE_CODE_RETRIES = 3;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeService: OrderCodeService,
    private readonly whatsapp: WhatsappAdapter,
  ) {}

  // ── Guest: preview & booking (API_CONTRACT §5.0–5.1) ──────────────

  /** Hitung harga live TANPA menyimpan (D19) — kalkulasi tetap 1 sumber (KG2). */
  async preview(dto: CreateOrderDto): Promise<{ data: unknown }> {
    const resolved = await this.resolveItems(dto.items);
    const voucher = await this.resolveVoucher(dto.promo_code);
    const priced = this.price(resolved, voucher, dto.deposit_percent ?? 0);

    return {
      data: {
        items: resolved.map((item, i) => ({
          catalog_type: item.catalog_type,
          item_name: item.item_name,
          item_code: item.item_code,
          start_date: item.start_date,
          end_date: item.end_date,
          qty: item.qty,
          unit_price: item.unit_price,
          delivery_slot: item.delivery_slot,
          is_discount: item.is_discount,
          ...priced.items[i],
        })),
        grand_total: priced.grand_total,
        deposit_percent: dto.deposit_percent ?? 0,
        deposit_amount: priced.deposit_amount,
        total_with_deposit: priced.total_with_deposit,
      },
    };
  }

  /** Buat booking guest: snapshot harga, hitung total, terbitkan kode DR- (⭐). */
  async create(dto: CreateOrderDto): Promise<{ data: unknown }> {
    const resolved = await this.resolveItems(dto.items);
    const voucher = await this.resolveVoucher(dto.promo_code);
    const priced = this.price(resolved, voucher, dto.deposit_percent ?? 0);

    const customerName = dto.customer.name.trim();
    const customerPhone = dto.customer.phone.trim();

    // Kode unik (code & code_number): bila balapan dengan request lain,
    // hitung ulang MAX+1 dan coba lagi — pola ProductsService (Tahap 1)
    let lastError: unknown;
    for (let attempt = 0; attempt < CREATE_CODE_RETRIES; attempt++) {
      const next = await this.codeService.nextOrderCode();
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const customer = await this.findOrCreateCustomer(tx, {
            name: customerName,
            phone: customerPhone,
          });
          return tx.order.create({
            data: {
              code: next.code,
              code_number: next.code_number,
              invoice_date: new Date(next.invoice_date),
              customer_id: customer.id,
              customer_name: customerName,
              customer_phone: customerPhone,
              alamat_shooting: dto.alamat_shooting,
              purpose: dto.purpose,
              promo_code: voucher?.code ?? null,
              is_dp: dto.is_dp ?? false,
              deposit_percent: dto.deposit_percent ?? 0,
              grand_total: priced.grand_total,
              deposit_amount: priced.deposit_amount,
              total_with_deposit: priced.total_with_deposit,
              items: { create: this.itemRows(resolved, priced) },
            },
            include: { items: { orderBy: { line_no: 'asc' } } },
          });
        });

        return {
          data: {
            ...this.toOrderResponse(order),
            whatsapp_admin_url: this.whatsapp.adminOrderUrl(
              order.code,
              order.customer_name,
            ),
          },
        };
      } catch (e) {
        if (this.isUniqueViolation(e)) {
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException({
      code: 'CONFLICT',
      message: 'Nomor order bentrok terus-menerus — coba beberapa saat lagi',
      details: [],
      cause: lastError,
    });
  }

  /** Cek status oleh customer: kode order + phone (guest, rate-limited). */
  async lookup(query: OrderLookupQueryDto): Promise<{ data: unknown }> {
    const order = await this.prisma.order.findUnique({
      where: { code: query.code.trim() },
    });
    if (
      !order ||
      normalizePhone(order.customer_phone) !== normalizePhone(query.phone)
    ) {
      // Satu pesan untuk dua sebab — jangan bocorkan kode mana yang valid
      throw new NotFoundException(
        'Order tidak ditemukan atau nomor telepon tidak cocok',
      );
    }
    return {
      data: {
        code: order.code,
        invoice_date: dateOnly(order.invoice_date),
        customer_name: order.customer_name,
        status_transaksi: order.status_transaksi,
        status_pembayaran: order.status_pembayaran,
        total_with_deposit: order.total_with_deposit,
        confirmed: order.confirmed_at !== null, // sudah dikonfirmasi admin? (D1)
      },
    };
  }

  // ── Admin: list & detail (API_CONTRACT §5.2, D17) ──────────────────

  /** List ringkas + filter — dashboard admin. */
  async list(query: OrderListQueryDto): Promise<ListResponse<unknown>> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status_transaksi: query.status } : {}),
      ...(query.payment ? { status_pembayaran: query.payment } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' } },
              { customer_name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            invoice_date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          _count: { select: { items: true } },
          ...(query.include === 'items'
            ? { items: { orderBy: { line_no: 'asc' as const } } }
            : {}),
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return listResponse(
      rows.map((order) => ({
        code: order.code,
        invoice_date: dateOnly(order.invoice_date),
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        item_count: order._count.items,
        grand_total: order.grand_total,
        total_with_deposit: order.total_with_deposit,
        is_dp: order.is_dp,
        status_transaksi: order.status_transaksi,
        status_pembayaran: order.status_pembayaran,
        confirmed_at: order.confirmed_at,
        created_at: order.created_at,
        ...('items' in order && Array.isArray(order.items)
          ? { items: order.items.map((i) => this.toItemResponse(i)) }
          : {}),
      })),
      query.page,
      query.limit,
      total,
    );
  }

  /**
   * Detail AGREGAT — 1 panggilan berisi items + billing (+ payments/penalties
   * menyusul Tahap 4–5; bentuk respons sudah disiapkan agar kontrak FE stabil).
   */
  async detail(code: string): Promise<{ data: unknown }> {
    const order = await this.findByCodeOrThrow(code);
    const total_tagihan = order.total_with_deposit; // + Σ denda (Tahap 5)
    const total_paid = 0; // Σ ledger payments (Tahap 4)
    return {
      data: {
        ...this.toOrderResponse(order),
        billing: {
          total_tagihan,
          total_paid,
          outstanding: total_tagihan - total_paid,
          status_pembayaran: order.status_pembayaran,
        },
        payments: [],
        penalties: [],
      },
    };
  }

  // ── Admin: kelola order ────────────────────────────────────────────

  /**
   * Edit order (mirip Dashboard Update Pesanan): recompute total via Pricing
   * Engine; `code` & `invoice_date` TETAP (BUSINESS_FLOW §5). `items` yang
   * dikirim MENGGANTI seluruh baris (harga baris baru = snapshot katalog saat
   * ini); tanpa `items`, baris lama & harga snapshot-nya dipertahankan.
   */
  async update(code: string, dto: UpdateOrderDto): Promise<{ data: unknown }> {
    const order = await this.findByCodeOrThrow(code);

    const promoEffective =
      dto.promo_code === undefined ? order.promo_code : dto.promo_code;
    const voucher = await this.resolveVoucher(promoEffective);
    const depositPercent = dto.deposit_percent ?? order.deposit_percent;

    const resolved = dto.items
      ? await this.resolveItems(dto.items)
      : order.items.map((item): ResolvedItem => ({
          catalog_type: item.catalog_type,
          product_id: item.product_id,
          bundle_id: item.bundle_id,
          item_name: item.item_name,
          item_code: item.item_code,
          start_date: dateOnly(item.start_date),
          end_date: dateOnly(item.end_date),
          qty: item.qty,
          unit_price: item.unit_price, // snapshot lama dipertahankan (R3)
          is_discount: item.is_discount,
          delivery_slot: item.delivery_slot,
        }));
    const priced = this.price(resolved, voucher, depositPercent);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { order_id: order.id } });
      return tx.order.update({
        where: { id: order.id },
        data: {
          // snapshot penyewa boleh dikoreksi; relasi customer_id tetap
          ...(dto.customer
            ? {
                customer_name: dto.customer.name.trim(),
                customer_phone: dto.customer.phone.trim(),
              }
            : {}),
          ...(dto.alamat_shooting !== undefined
            ? { alamat_shooting: dto.alamat_shooting }
            : {}),
          ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
          promo_code: voucher?.code ?? null,
          ...(dto.is_dp !== undefined ? { is_dp: dto.is_dp } : {}),
          deposit_percent: depositPercent,
          grand_total: priced.grand_total,
          deposit_amount: priced.deposit_amount,
          total_with_deposit: priced.total_with_deposit,
          items: { create: this.itemRows(resolved, priced) },
        },
        include: { items: { orderBy: { line_no: 'asc' } } },
      });
    });

    return { data: this.toOrderResponse(updated) };
  }

  /** Konfirmasi ketersediaan oleh admin (D1) — idempoten bila sudah dikonfirmasi. */
  async confirm(code: string, user: AuthUser): Promise<{ data: unknown }> {
    const order = await this.findByCodeOrThrow(code);
    this.rejectIfCancelled(order);
    if (order.confirmed_at) return { data: this.toOrderResponse(order) };

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { confirmed_at: new Date(), confirmed_by: user.id },
      include: { items: { orderBy: { line_no: 'asc' } } },
    });
    return { data: this.toOrderResponse(updated) };
  }

  /** Ubah status on_progress/completed — admin boleh override (BUSINESS_FLOW §3). */
  async changeStatus(
    code: string,
    dto: ChangeStatusDto,
  ): Promise<{ data: unknown }> {
    const order = await this.findByCodeOrThrow(code);
    this.rejectIfCancelled(order);

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status_transaksi: dto.status },
      include: { items: { orderBy: { line_no: 'asc' } } },
    });
    return { data: this.toOrderResponse(updated) };
  }

  /**
   * Batalkan order + disposisi DP (D15). Baris refund di ledger `payments`
   * dibuat lewat POST /payments setelah modul payments ada (Tahap 4).
   */
  async cancel(code: string, dto: CancelOrderDto): Promise<{ data: unknown }> {
    const order = await this.findByCodeOrThrow(code);
    this.rejectIfCancelled(order);

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status_transaksi: 'cancel',
        cancelled_at: new Date(),
        dp_disposition: dto.dp_disposition,
      },
      include: { items: { orderBy: { line_no: 'asc' } } },
    });
    return { data: this.toOrderResponse(updated) };
  }

  // ── Internal ───────────────────────────────────────────────────────

  /**
   * Validasi & resolusi keranjang ke katalog (API_CONTRACT §5.1):
   * tanggal urut, produk/bundle aktif, qty ≥ min_qty catering; harga snapshot.
   */
  private async resolveItems(
    items: OrderItemInputDto[],
  ): Promise<ResolvedItem[]> {
    const errors: string[] = [];

    for (const [i, item] of items.entries()) {
      if (durationDays(item.start_date, item.end_date) < 1) {
        errors.push(
          `items[${i}]: end_date (${item.end_date}) lebih awal dari start_date (${item.start_date})`,
        );
      }
    }

    const productCodes = items
      .filter((i) => i.catalog_type === 'product')
      .map((i) => i.code);
    const bundleCodes = items
      .filter((i) => i.catalog_type === 'bundle')
      .map((i) => i.code);

    const [products, bundles] = await Promise.all([
      this.prisma.product.findMany({
        where: { code: { in: productCodes }, is_active: true },
      }),
      this.prisma.bundle.findMany({
        where: { code: { in: bundleCodes }, is_active: true },
      }),
    ]);
    const productByCode = new Map(products.map((p) => [p.code, p]));
    const bundleByCode = new Map(bundles.map((b) => [b.code, b]));

    const resolved = items.map((item, i): ResolvedItem | null => {
      if (item.catalog_type === 'product') {
        const product = productByCode.get(item.code);
        if (!product) {
          errors.push(
            `items[${i}]: produk '${item.code}' tidak ditemukan atau nonaktif`,
          );
          return null;
        }
        if (product.min_qty && item.qty < product.min_qty) {
          errors.push(
            `items[${i}]: '${product.name}' minimal ${product.min_qty} ${product.unit_label} (qty diminta: ${item.qty})`,
          );
          return null;
        }
        return {
          catalog_type: 'product',
          product_id: product.id,
          bundle_id: null,
          item_name: product.name,
          item_code: product.code,
          start_date: item.start_date,
          end_date: item.end_date,
          qty: item.qty,
          unit_price: product.base_price,
          is_discount: item.is_discount ?? false,
          delivery_slot: item.delivery_slot ?? null,
        };
      }

      const bundle = bundleByCode.get(item.code);
      if (!bundle) {
        errors.push(
          `items[${i}]: bundle '${item.code}' tidak ditemukan atau nonaktif`,
        );
        return null;
      }
      // Bundle = 1 baris order_item dengan harga bundle (D10)
      return {
        catalog_type: 'bundle',
        product_id: null,
        bundle_id: bundle.id,
        item_name: bundle.name,
        item_code: bundle.code,
        start_date: item.start_date,
        end_date: item.end_date,
        qty: item.qty,
        unit_price: bundle.bundle_price,
        is_discount: item.is_discount ?? false,
        delivery_slot: item.delivery_slot ?? null,
      };
    });

    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Data booking tidak valid',
        details: errors,
      });
    }
    return resolved as ResolvedItem[];
  }

  /** Voucher: lookup case-insensitive (D22 ⑥/D25); tidak dikenal/nonaktif = 422. */
  private async resolveVoucher(
    promo_code: string | null | undefined,
  ): Promise<Voucher | null> {
    const code = promo_code?.trim();
    if (!code) return null;

    const voucher = await this.prisma.voucher.findFirst({
      where: { code: { equals: code, mode: 'insensitive' }, is_active: true },
    });
    if (!voucher) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Kode promo tidak dikenal atau sudah nonaktif',
        details: [`promo_code: '${code}'`],
      });
    }
    return voucher;
  }

  private price(
    resolved: ResolvedItem[],
    voucher: Voucher | null,
    deposit_percent: number,
  ): PricedOrder {
    const inputs: PricingItemInput[] = resolved.map((item) => ({
      start_date: item.start_date,
      end_date: item.end_date,
      qty: item.qty,
      unit_price: item.unit_price,
      is_discount: item.is_discount,
    }));
    const info: PricingVoucher | null = voucher
      ? { type: voucher.type, value: voucher.value }
      : null;
    return priceOrder(inputs, info, deposit_percent);
  }

  /** Gabungkan hasil resolusi + kalkulasi menjadi baris order_items siap-create. */
  private itemRows(
    resolved: ResolvedItem[],
    priced: PricedOrder,
  ): Prisma.OrderItemCreateWithoutOrderInput[] {
    return resolved.map((item, i) => ({
      line_no: i + 1,
      catalog_type: item.catalog_type,
      ...(item.product_id
        ? { product: { connect: { id: item.product_id } } }
        : {}),
      ...(item.bundle_id
        ? { bundle: { connect: { id: item.bundle_id } } }
        : {}),
      item_name: item.item_name,
      item_code: item.item_code,
      start_date: new Date(item.start_date),
      end_date: new Date(item.end_date),
      duration: priced.items[i].duration,
      qty: item.qty,
      unit_price: item.unit_price,
      amount: priced.items[i].amount,
      rental_total: priced.items[i].rental_total,
      is_discount: item.is_discount,
      discount_percent: priced.items[i].discount_percent,
      discount_amount: priced.items[i].discount_amount,
      sub_total: priced.items[i].sub_total,
      delivery_slot: item.delivery_slot,
    }));
  }

  /** Dedup penyewa guest per nomor telepon (DATA_MODEL §3.2); tak ada → buat. */
  private async findOrCreateCustomer(
    tx: Prisma.TransactionClient,
    input: { name: string; phone: string },
  ): Promise<{ id: string }> {
    const existing = await tx.customer.findFirst({
      where: { phone: input.phone },
      select: { id: true },
    });
    if (existing) return existing;
    return tx.customer.create({
      data: { name: input.name, phone: input.phone },
      select: { id: true },
    });
  }

  private async findByCodeOrThrow(code: string): Promise<OrderWithItems> {
    const order = await this.prisma.order.findUnique({
      where: { code },
      include: { items: { orderBy: { line_no: 'asc' } } },
    });
    if (!order) {
      throw new NotFoundException(`Order '${code}' tidak ditemukan`);
    }
    return order;
  }

  private rejectIfCancelled(order: Order): void {
    if (order.status_transaksi === 'cancel') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Order '${order.code}' sudah dibatalkan`,
        details: [],
      });
    }
  }

  private isUniqueViolation(e: unknown): boolean {
    return (
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
    );
  }

  /** Bentuk respons order lengkap (siap-invoice, D8) — tanggal ISO date-only. */
  private toOrderResponse(order: OrderWithItems): Record<string, unknown> {
    return {
      code: order.code,
      invoice_date: dateOnly(order.invoice_date),
      customer: { name: order.customer_name, phone: order.customer_phone },
      alamat_shooting: order.alamat_shooting,
      purpose: order.purpose,
      promo_code: order.promo_code,
      items: order.items.map((item) => this.toItemResponse(item)),
      grand_total: order.grand_total,
      is_dp: order.is_dp,
      deposit_percent: order.deposit_percent,
      deposit_amount: order.deposit_amount,
      total_with_deposit: order.total_with_deposit,
      status_transaksi: order.status_transaksi,
      status_pembayaran: order.status_pembayaran,
      confirmed_at: order.confirmed_at,
      confirmed_by: order.confirmed_by,
      cancelled_at: order.cancelled_at,
      dp_disposition: order.dp_disposition,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  private toItemResponse(item: OrderItem): Record<string, unknown> {
    return {
      line_no: item.line_no,
      catalog_type: item.catalog_type,
      item_name: item.item_name,
      item_code: item.item_code,
      start_date: dateOnly(item.start_date),
      end_date: dateOnly(item.end_date),
      duration: item.duration,
      qty: item.qty,
      unit_price: item.unit_price,
      amount: item.amount,
      rental_total: item.rental_total,
      is_discount: item.is_discount,
      discount_percent: item.discount_percent,
      discount_amount: item.discount_amount,
      sub_total: item.sub_total,
      delivery_slot: item.delivery_slot,
    };
  }
}
