import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VouchersService } from './vouchers.service';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  VoucherListQueryDto,
} from './dto/voucher.dto';

/**
 * Kelola voucher (admin) — GET/POST/PATCH sesuai API_CONTRACT §4 (tanpa DELETE;
 * nonaktifkan via PATCH is_active=false).
 * TODO(Tahap 2): pasang JwtAuthGuard + RolesGuard(admin) SEBELUM deploy mana pun.
 */
@ApiTags('catalog-admin')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar semua voucher (admin)' })
  list(@Query() query: VoucherListQueryDto) {
    return this.vouchers.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Buat voucher — percent atau nominal (admin)' })
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah voucher (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchers.update(id, dto);
  }
}
