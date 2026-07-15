import { Module } from '@nestjs/common';
import {
  OrderPenaltiesController,
  PenaltiesController,
} from './penalties.controller';
import { PenaltiesService } from './penalties.service';

/**
 * Denda (Tahap 5): SATU per order, kode `{order}-D`, kategori incl. overtime
 * (D4/D14); grand_total denda menambah total_tagihan (BUSINESS_FLOW §6).
 */
@Module({
  controllers: [OrderPenaltiesController, PenaltiesController],
  providers: [PenaltiesService],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
