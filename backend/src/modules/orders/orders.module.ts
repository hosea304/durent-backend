import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OrdersAdminController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderCodeService } from './order-code.service';

/**
 * Inti flow rental (Tahap 3): order multi-item multi-tanggal + Pricing Engine
 * (SEMUA kalkulasi uang — pricing-engine.ts) + Code Generator DR-DDMMYY-NNNN.
 * Urutan controllers penting: publik dulu (lookup vs :code).
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [OrdersController, OrdersAdminController],
  providers: [OrdersService, OrderCodeService],
  exports: [OrdersService],
})
export class OrdersModule {}
