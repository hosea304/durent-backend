import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { SegmentType } from '../../generated/prisma/client';

const SEGMENT_TYPES: SegmentType[] = [
  'brand',
  'universal',
  'category_utama',
  'sub_category',
];

class CodeSegmentQueryDto {
  @IsOptional()
  @IsIn(SEGMENT_TYPES)
  segment_type?: SegmentType;
}

/**
 * Daftar segmen kode untuk form pembuatan produk/bundling (admin).
 * Data referensi kecil — tanpa paging.
 * TODO(Tahap 2): pasang JwtAuthGuard + RolesGuard(admin) SEBELUM deploy mana pun.
 */
@ApiTags('catalog-admin')
@Controller('code-segments')
export class CodeSegmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar segmen kode aktif — filter ?segment_type= (admin)',
  })
  async list(@Query() query: CodeSegmentQueryDto) {
    const rows = await this.prisma.codeSegment.findMany({
      where: {
        is_active: true,
        ...(query.segment_type ? { segment_type: query.segment_type } : {}),
      },
      orderBy: [{ segment_type: 'asc' }, { code: 'asc' }],
      select: { segment_type: true, code: true, description: true },
    });
    return { data: rows, meta: { total: rows.length } };
  }
}
