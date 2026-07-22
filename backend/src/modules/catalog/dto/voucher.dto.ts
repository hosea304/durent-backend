import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VoucherType } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const VOUCHER_TYPES: VoucherType[] = ['percent', 'nominal'];
/** Batas atas defensif nominal voucher (percent tetap dicek 1–100 di service). */
const MAX_RUPIAH = 1_000_000_000;

export class VoucherListQueryDto extends PaginationQueryDto {}

/** POST /vouchers — voucher = persen ATAU nominal (D13). */
export class CreateVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsIn(VOUCHER_TYPES)
  type!: VoucherType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RUPIAH)
  value!: number; // percent: 1–100 (dicek service) · nominal: rupiah
}

/** PATCH /vouchers/{id} */
export class UpdateVoucherDto {
  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  type?: VoucherType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RUPIAH)
  value?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
