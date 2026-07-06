import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VoucherType } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const VOUCHER_TYPES: VoucherType[] = ['percent', 'nominal'];

export class VoucherListQueryDto extends PaginationQueryDto {}

/** POST /vouchers — voucher = persen ATAU nominal (D13). */
export class CreateVoucherDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsIn(VOUCHER_TYPES)
  type!: VoucherType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
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
  value?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
