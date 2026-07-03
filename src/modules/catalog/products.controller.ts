import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  PreviewCodeDto,
  ProductListQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

/** Katalog publik (guest) — hanya produk aktif. Cache ringan untuk halaman customer (D17). */
@ApiTags('catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'Katalog produk (publik) — filter ?type=&q=&page=&limit=',
  })
  list(@Query() query: ProductListQueryDto) {
    return this.products.findPublic(query);
  }

  @Get(':code')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Detail produk by kode (publik)' })
  detail(@Param('code') code: string) {
    return this.products.findPublicByCode(code);
  }
}

/**
 * Kelola produk (admin) — API_CONTRACT §4.
 * TODO(Tahap 2): pasang JwtAuthGuard + RolesGuard(admin) SEBELUM deploy mana pun.
 * Saat ini dev-only (disepakati pemilik saat perencanaan Tahap 1).
 */
@ApiTags('catalog-admin')
@Controller('products')
export class ProductsAdminController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat produk — server susun kode dari segmen (admin)',
  })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Post('preview-code')
  @ApiOperation({
    summary: 'Pratinjau kode produk berikutnya dari segmen (admin)',
  })
  previewCode(@Body() dto: PreviewCodeDto) {
    return this.products.previewCode(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah produk — code immutable (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Pensiunkan produk — soft delete (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.softDelete(id);
  }
}
