import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Product } from '../../generated/prisma/client';
import { ListResponse, listResponse } from '../../common/utils/list-response';
import { ProductCodeService } from './product-code.service';
import {
  CreateProductDto,
  PreviewCodeDto,
  ProductListQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

/** Baris ringkas katalog publik (API_CONTRACT §4: list ≠ detail). */
const PUBLIC_LIST_SELECT = {
  code: true,
  name: true,
  type: true,
  base_price: true,
  unit_label: true,
  min_qty: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeService: ProductCodeService,
  ) {}

  /** Katalog publik — hanya produk aktif. */
  async findPublic(query: ProductListQueryDto): Promise<ListResponse<unknown>> {
    const where: Prisma.ProductWhereInput = {
      is_active: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PUBLIC_LIST_SELECT,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return listResponse(rows, query.page, query.limit, total);
  }

  /** Detail publik by code — hanya aktif. */
  async findPublicByCode(code: string): Promise<{ data: Product }> {
    const product = await this.prisma.product.findFirst({
      where: { code, is_active: true },
    });
    if (!product) {
      throw new NotFoundException(`Produk '${code}' tidak ditemukan`);
    }
    return { data: product };
  }

  /** Admin: buat produk — server susun kode dari segmen (D12/KG3). */
  async create(dto: CreateProductDto): Promise<{ data: Product }> {
    const { code, code_number } = await this.codeService.nextProductCode(
      dto.type,
      dto.category_utama_code,
      dto.sub_category_code,
    );

    try {
      const product = await this.prisma.product.create({
        data: {
          code,
          code_number,
          name: dto.name,
          type: dto.type,
          category_utama_code: dto.category_utama_code,
          sub_category_code: dto.sub_category_code,
          base_price: dto.base_price,
          pricing_basis: dto.pricing_basis,
          unit_label: dto.unit_label,
          min_qty: dto.min_qty ?? null,
          is_returnable: dto.is_returnable,
        },
      });
      return { data: product };
    } catch (e) {
      this.rethrowUniqueAsConflict(e, code);
      throw e;
    }
  }

  /** Admin: pratinjau kode berikutnya tanpa membuat produk. */
  async previewCode(dto: PreviewCodeDto): Promise<{ data: { code: string } }> {
    const { code } = await this.codeService.nextProductCode(
      dto.type,
      dto.category_utama_code,
      dto.sub_category_code,
    );
    return { data: { code } };
  }

  /** Admin: ubah produk — code/type/segmen immutable. */
  async update(id: string, dto: UpdateProductDto): Promise<{ data: Product }> {
    await this.ensureExists(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
    });
    return { data: product };
  }

  /** Admin: pensiunkan produk — SOFT delete, kode tetap terpakai (D12). */
  async softDelete(id: string): Promise<{ data: Product }> {
    await this.ensureExists(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { is_active: false },
    });
    return { data: product };
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Produk tidak ditemukan');
  }

  private rethrowUniqueAsConflict(e: unknown, code: string): void {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Kode '${code}' sudah terpakai — coba ulangi (nomor urut akan dihitung ulang)`,
        details: [],
      });
    }
  }
}
