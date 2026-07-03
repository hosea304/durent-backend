import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { ListResponse, listResponse } from '../../common/utils/list-response';
import { ProductCodeService } from './product-code.service';
import {
  BundleItemInputDto,
  CreateBundleDto,
  UpdateBundleDto,
} from './dto/bundle.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

type BundleWithItems = Prisma.BundleGetPayload<{ include: { items: true } }>;

/** Data komponen siap-simpan setelah resolusi product_code. */
interface ResolvedItem {
  product_id: string | null;
  sku_name: string;
  sku_code: string;
  qty: number;
  component_price: number;
}

@Injectable()
export class BundlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeService: ProductCodeService,
  ) {}

  /** Katalog publik: bundle aktif + original_price (harga coret, FG2). */
  async findPublic(query: PaginationQueryDto): Promise<ListResponse<unknown>> {
    const where: Prisma.BundleWhereInput = { is_active: true };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bundle.findMany({
        where,
        include: { items: true },
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.bundle.count({ where }),
    ]);
    return listResponse(
      rows.map((b) => this.toPublicSummary(b)),
      query.page,
      query.limit,
      total,
    );
  }

  /** Detail publik + komponen. */
  async findPublicByCode(code: string): Promise<{ data: unknown }> {
    const bundle = await this.prisma.bundle.findFirst({
      where: { code, is_active: true },
      include: { items: true },
    });
    if (!bundle) {
      throw new NotFoundException(`Bundling '${code}' tidak ditemukan`);
    }
    return {
      data: {
        ...this.toPublicSummary(bundle),
        items: bundle.items.map((it) => ({
          sku_name: it.sku_name,
          sku_code: it.sku_code,
          qty: it.qty,
          component_price: it.component_price,
        })),
      },
    };
  }

  /** Admin: buat bundling + komponen (kode disusun server). */
  async create(dto: CreateBundleDto): Promise<{ data: unknown }> {
    const resolved = await this.resolveItems(dto.items);
    const { code, code_number } = await this.codeService.nextBundleCode(
      dto.category_utama_code,
    );

    try {
      const bundle = await this.prisma.bundle.create({
        data: {
          code,
          code_number,
          name: dto.name,
          type: dto.type,
          category_utama_code: dto.category_utama_code,
          bundle_price: dto.bundle_price,
          items: { create: resolved },
        },
        include: { items: true },
      });
      return { data: this.toAdminDetail(bundle) };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `Kode '${code}' sudah terpakai — coba ulangi`,
          details: [],
        });
      }
      throw e;
    }
  }

  /** Admin: ubah bundling; `items` bila dikirim = replace seluruh komponen. */
  async update(id: string, dto: UpdateBundleDto): Promise<{ data: unknown }> {
    await this.ensureExists(id);
    const resolved = dto.items ? await this.resolveItems(dto.items) : null;

    const bundle = await this.prisma.$transaction(async (tx) => {
      if (resolved) {
        await tx.bundleItem.deleteMany({ where: { bundle_id: id } });
        await tx.bundleItem.createMany({
          data: resolved.map((r) => ({ ...r, bundle_id: id })),
        });
      }
      return tx.bundle.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.bundle_price !== undefined
            ? { bundle_price: dto.bundle_price }
            : {}),
          ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        },
        include: { items: true },
      });
    });
    return { data: this.toAdminDetail(bundle) };
  }

  /** Admin: pensiunkan bundling — soft delete. */
  async softDelete(id: string): Promise<{ data: unknown }> {
    await this.ensureExists(id);
    const bundle = await this.prisma.bundle.update({
      where: { id },
      data: { is_active: false },
      include: { items: true },
    });
    return { data: this.toAdminDetail(bundle) };
  }

  /** original_price = Σ(qty × component_price) — dihitung, tidak disimpan. */
  private originalPrice(bundle: BundleWithItems): number {
    return bundle.items.reduce(
      (sum, it) => sum + it.qty * it.component_price,
      0,
    );
  }

  private toPublicSummary(bundle: BundleWithItems): Record<string, unknown> {
    return {
      code: bundle.code,
      name: bundle.name,
      type: bundle.type,
      bundle_price: bundle.bundle_price,
      original_price: this.originalPrice(bundle),
    };
  }

  private toAdminDetail(bundle: BundleWithItems): Record<string, unknown> {
    return {
      ...bundle,
      original_price: this.originalPrice(bundle),
    };
  }

  /**
   * Validasi & lengkapi komponen: `product_code` → snapshot dari products;
   * tanpa product_code → sku_name+sku_code+component_price wajib lengkap.
   */
  private async resolveItems(
    items: BundleItemInputDto[],
  ): Promise<ResolvedItem[]> {
    const errors: string[] = [];
    const resolved: ResolvedItem[] = [];

    for (const [i, item] of items.entries()) {
      if (item.product_code) {
        const product = await this.prisma.product.findFirst({
          where: { code: item.product_code, is_active: true },
        });
        if (!product) {
          errors.push(
            `items[${i}]: produk '${item.product_code}' tidak ditemukan/nonaktif`,
          );
          continue;
        }
        resolved.push({
          product_id: product.id,
          sku_name: item.sku_name ?? product.name,
          sku_code: product.code,
          qty: item.qty,
          component_price: item.component_price ?? product.base_price,
        });
      } else if (
        item.sku_name &&
        item.sku_code &&
        item.component_price !== undefined
      ) {
        resolved.push({
          product_id: null,
          sku_name: item.sku_name,
          sku_code: item.sku_code,
          qty: item.qty,
          component_price: item.component_price,
        });
      } else {
        errors.push(
          `items[${i}]: isi product_code, ATAU lengkapi sku_name+sku_code+component_price`,
        );
      }
    }

    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Komponen bundling tidak valid',
        details: errors,
      });
    }
    return resolved;
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.bundle.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Bundling tidak ditemukan');
  }
}
