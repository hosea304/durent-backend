import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
 * Daftar segmen kode untuk form pembuatan produk/bundling.
 * Data referensi kecil — tanpa paging. Hanya admin/owner (RBAC).
 */
@ApiTags('catalog-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
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
