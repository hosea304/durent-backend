import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';

/** Pembayaran per-order — admin/owner (API_CONTRACT §6). */
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
@Controller('orders/:code')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('billing')
  @ApiOperation({
    summary:
      'Ringkas tagihan: total_tagihan, total_paid, outstanding, status (admin)',
  })
  billing(@Param('code') code: string) {
    return this.payments.billing(code);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Daftar ledger pembayaran milik order (admin)' })
  list(@Param('code') code: string) {
    return this.payments.listByOrder(code);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Catat dp/pelunasan/refund → recompute status pembayaran (admin)',
  })
  create(@Param('code') code: string, @Body() dto: CreatePaymentDto) {
    return this.payments.addPayment(code, dto);
  }
}
