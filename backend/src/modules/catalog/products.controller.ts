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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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

/** Kelola produk — hanya admin/owner (RBAC, BACKEND_ARCHITECTURE §7). */
@ApiTags('catalog-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
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
