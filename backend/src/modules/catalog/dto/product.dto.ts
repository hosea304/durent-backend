import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PricingBasis, ProductType } from '../../../generated/prisma/client';

/** `location` ditolak di MVP — sewa lokasi = Phase 2 (D3). */
export const MVP_PRODUCT_TYPES: ProductType[] = [
  'rental',
  'expendable',
  'catering',
  'crew',
];

export const PRICING_BASES: PricingBasis[] = [
  'per_day_unit',
  'per_unit',
  'per_package',
  'per_person_day',
];

/** GET /products?type=&q=&page=&limit= */
export class ProductListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(MVP_PRODUCT_TYPES)
  type?: ProductType;

  @IsOptional()
  @IsString()
  q?: string;
}

/** POST /products — server yang menyusun `code` dari segmen (API_CONTRACT §4). */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(MVP_PRODUCT_TYPES)
  type!: ProductType;

  @IsString()
  @IsNotEmpty()
  category_utama_code!: string;

  @IsString()
  @IsNotEmpty()
  sub_category_code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  base_price!: number; // integer rupiah

  @IsIn(PRICING_BASES)
  pricing_basis!: PricingBasis;

  @IsString()
  @IsNotEmpty()
  unit_label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_qty?: number;

  @IsBoolean()
  is_returnable!: boolean;
}

/** PATCH /products/{id} — `code`, `type`, dan segmen kode IMMUTABLE (D12). */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  base_price?: number;

  @IsOptional()
  @IsIn(PRICING_BASES)
  pricing_basis?: PricingBasis;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit_label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_qty?: number;

  @IsOptional()
  @IsBoolean()
  is_returnable?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean; // reaktivasi produk yang dipensiunkan
}

/** POST /products/preview-code — pratinjau kode dari segmen dipilih. */
export class PreviewCodeDto {
  @IsIn(MVP_PRODUCT_TYPES)
  type!: ProductType;

  @IsString()
  @IsNotEmpty()
  category_utama_code!: string;

  @IsString()
  @IsNotEmpty()
  sub_category_code!: string;
}
