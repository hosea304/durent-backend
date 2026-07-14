import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * Ledger pembayaran (Tahap 4): dp → pelunasan → refund per order (R5/D15);
 * status pembayaran diturunkan dari ledger, default belum_lunas (D6).
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
