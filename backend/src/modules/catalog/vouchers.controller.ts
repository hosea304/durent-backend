import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VouchersService } from './vouchers.service';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  VoucherListQueryDto,
} from './dto/voucher.dto';

/**
 * Kelola voucher — hanya admin/owner (RBAC). GET/POST/PATCH sesuai API_CONTRACT §4
 * (tanpa DELETE; nonaktifkan via PATCH is_active=false).
 */
@ApiTags('catalog-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
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
