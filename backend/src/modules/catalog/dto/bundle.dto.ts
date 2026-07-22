import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductType } from '../../../generated/prisma/client';
import { MVP_PRODUCT_TYPES } from './product.dto';

/** Batas atas defensif — cegah overflow snapshot & payload raksasa. */
const MAX_RUPIAH = 1_000_000_000;
const MAX_QTY = 1_000_000;
const MAX_ITEMS = 100;

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
  @MaxLength(60)
  product_code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  sku_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sku_code?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QTY)
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_RUPIAH)
  component_price?: number; // harga SATUAN komponen (rupiah)
}

/** POST /bundles — kode disusun server: {DS}-{universal}-{cat_utama}-{NNNN}. */
export class CreateBundleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsIn(MVP_PRODUCT_TYPES)
  type!: ProductType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  category_utama_code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_RUPIAH)
  bundle_price!: number; // harga khusus manual

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items!: BundleItemInputDto[];
}

/** PATCH /bundles/{id} — `code` immutable; `items` bila dikirim = REPLACE seluruh komponen. */
export class UpdateBundleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_RUPIAH)
  bundle_price?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items?: BundleItemInputDto[];
}
