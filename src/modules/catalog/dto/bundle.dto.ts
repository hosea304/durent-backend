import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductType } from '../../../generated/prisma/client';
import { MVP_PRODUCT_TYPES } from './product.dto';

/**
 * Komponen bundling. Dua cara mengisi:
 * 1. `product_code` → sku_name/sku_code/component_price diambil dari products
 *    (component_price boleh dioverride);
 * 2. manual: sku_name + sku_code + component_price lengkap (tanpa tautan produk).
 */
export class BundleItemInputDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  product_code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku_code?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  component_price?: number; // harga SATUAN komponen (rupiah)
}

/** POST /bundles — kode disusun server: {DS}-{universal}-{cat_utama}-{NNNN}. */
export class CreateBundleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(MVP_PRODUCT_TYPES)
  type!: ProductType;

  @IsString()
  @IsNotEmpty()
  category_utama_code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  bundle_price!: number; // harga khusus manual

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items!: BundleItemInputDto[];
}

/** PATCH /bundles/{id} — `code` immutable; `items` bila dikirim = REPLACE seluruh komponen. */
export class UpdateBundleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bundle_price?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items?: BundleItemInputDto[];
}
