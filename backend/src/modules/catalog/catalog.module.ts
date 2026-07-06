import { Module } from '@nestjs/common';
import {
  ProductsAdminController,
  ProductsController,
} from './products.controller';
import {
  BundlesAdminController,
  BundlesController,
} from './bundles.controller';
import { VouchersController } from './vouchers.controller';
import { CodeSegmentsController } from './code-segments.controller';
import { ProductsService } from './products.service';
import { BundlesService } from './bundles.service';
import { VouchersService } from './vouchers.service';
import { ProductCodeService } from './product-code.service';

/** Produk, bundling, sistem kode, voucher — Tahap 1 (TASK_BREAKDOWN). */
@Module({
  controllers: [
    ProductsController,
    ProductsAdminController,
    BundlesController,
    BundlesAdminController,
    VouchersController,
    CodeSegmentsController,
  ],
  providers: [
    ProductsService,
    BundlesService,
    VouchersService,
    ProductCodeService,
  ],
  exports: [ProductsService, BundlesService, VouchersService],
})
export class CatalogModule {}
