import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Voucher } from '../../generated/prisma/client';
import { ListResponse, listResponse } from '../../common/utils/list-response';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  VoucherListQueryDto,
} from './dto/voucher.dto';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin: semua voucher (termasuk nonaktif) untuk pengelolaan. */
  async findAll(query: VoucherListQueryDto): Promise<ListResponse<Voucher>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.voucher.findMany({
        orderBy: { code: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.voucher.count(),
    ]);
    return listResponse(rows, query.page, query.limit, total);
  }

  async create(dto: CreateVoucherDto): Promise<{ data: Voucher }> {
    this.ensureValueValid(dto.type, dto.value);
    try {
      const voucher = await this.prisma.voucher.create({ data: dto });
      return { data: voucher };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `Voucher '${dto.code}' sudah ada`,
          details: [],
        });
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<{ data: Voucher }> {
    const existing = await this.prisma.voucher.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voucher tidak ditemukan');

    this.ensureValueValid(
      dto.type ?? existing.type,
      dto.value ?? existing.value,
    );
    const voucher = await this.prisma.voucher.update({
      where: { id },
      data: dto,
    });
    return { data: voucher };
  }

  /** percent harus 1–100; nominal bebas (rupiah > 0). */
  private ensureValueValid(type: Voucher['type'], value: number): void {
    if (type === 'percent' && value > 100) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Voucher persen tidak boleh melebihi 100',
        details: ['value: maksimal 100 untuk type percent'],
      });
    }
  }
}
