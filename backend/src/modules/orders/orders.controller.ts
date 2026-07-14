import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import {
  CancelOrderDto,
  ChangeStatusDto,
  CreateOrderDto,
  OrderListQueryDto,
  OrderLookupQueryDto,
  UpdateOrderDto,
} from './dto/order.dto';

/**
 * Endpoint publik (guest) — halaman booking customer (API_CONTRACT §5.0–5.1).
 * Terdaftar SEBELUM controller admin agar GET /orders/lookup menang atas
 * GET /orders/:code.
 */
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  // Harga live saat menyusun keranjang — boleh lebih sering dari create
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Preview harga booking — hitung tanpa menyimpan (guest, D19)',
  })
  preview(@Body() dto: CreateOrderDto) {
    return this.orders.preview(dto);
  }

  @Post()
  // Publik & menulis data → ketat (API_CONTRACT §1: rate limit endpoint publik)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Buat booking (guest) ⭐ — terbit kode DR- + URL WhatsApp admin',
  })
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get('lookup')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Cek status order oleh customer — ?code=&phone= (guest)',
  })
  lookup(@Query() query: OrderLookupQueryDto) {
    return this.orders.lookup(query);
  }
}

/** Kelola order — admin/owner; khusus ubah status juga gudang (API_CONTRACT §5.2). */
@ApiTags('orders-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
@Controller('orders')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({
    summary:
      'List order ringkas — ?status=&payment=&q=&from=&to=&include=items (admin)',
  })
  list(@Query() query: OrderListQueryDto) {
    return this.orders.list(query);
  }

  @Get(':code')
  @ApiOperation({
    summary:
      'Detail agregat 1 panggilan: items + billing (+payments/penalties)',
  })
  detail(@Param('code') code: string) {
    return this.orders.detail(code);
  }

  @Patch(':code')
  @ApiOperation({
    summary: 'Edit order — recompute total; code & invoice_date tetap (admin)',
  })
  update(@Param('code') code: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(code, dto);
  }

  @Post(':code/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Konfirmasi ketersediaan (D1) — isi confirmed_at/by (admin)',
  })
  confirm(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.orders.confirm(code, user);
  }

  @Post(':code/status')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'gudang', 'owner') // gudang boleh gerakkan status (🟠)
  @ApiOperation({
    summary: 'Ubah status on_progress/completed — admin boleh override',
  })
  changeStatus(@Param('code') code: string, @Body() dto: ChangeStatusDto) {
    return this.orders.changeStatus(code, dto);
  }

  @Post(':code/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Batalkan order + disposisi DP refund_full/forfeit/partial/none (D15)',
  })
  cancel(@Param('code') code: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(code, dto);
  }
}
