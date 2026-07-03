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
import { BundlesService } from './bundles.service';
import { CreateBundleDto, UpdateBundleDto } from './dto/bundle.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Katalog bundling publik — bundle_price + original_price (harga coret, FG2). */
@ApiTags('catalog')
@Controller('bundles')
export class BundlesController {
  constructor(private readonly bundles: BundlesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Daftar bundling (publik)' })
  list(@Query() query: PaginationQueryDto) {
    return this.bundles.findPublic(query);
  }

  @Get(':code')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Detail bundling + komponen (publik)' })
  detail(@Param('code') code: string) {
    return this.bundles.findPublicByCode(code);
  }
}

/**
 * Kelola bundling (admin).
 * TODO(Tahap 2): pasang JwtAuthGuard + RolesGuard(admin) SEBELUM deploy mana pun.
 */
@ApiTags('catalog-admin')
@Controller('bundles')
export class BundlesAdminController {
  constructor(private readonly bundles: BundlesService) {}

  @Post()
  @ApiOperation({ summary: 'Buat bundling + komponen (admin)' })
  create(@Body() dto: CreateBundleDto) {
    return this.bundles.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah bundling; items = replace komponen (admin)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBundleDto) {
    return this.bundles.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Pensiunkan bundling — soft delete (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundles.softDelete(id);
  }
}
