import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PenaltiesService } from './penalties.service';
import { CreatePenaltyDto } from './dto/penalty.dto';

/** Denda milik satu order — admin/owner (API_CONTRACT §7). */
@ApiTags('penalties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
@Controller('orders/:code/penalties')
export class OrderPenaltiesController {
  constructor(private readonly penalties: PenaltiesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Buat denda -D (SATU per order, D14) — kategori incl. overtime (D4)',
  })
  create(@Param('code') code: string, @Body() dto: CreatePenaltyDto) {
    return this.penalties.create(code, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Denda milik order (array 0/1 elemen)' })
  byOrder(@Param('code') code: string) {
    return this.penalties.byOrder(code);
  }
}

/** Detail denda langsung by kode `…-D` — admin/owner. */
@ApiTags('penalties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
@Controller('penalties')
export class PenaltiesController {
  constructor(private readonly penalties: PenaltiesService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Detail denda by kode (…-D) + billing order induk' })
  byCode(@Param('code') code: string) {
    return this.penalties.byCode(code);
  }
}
