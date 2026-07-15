import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PenaltyCategory } from '../../../generated/prisma/client';

/** Overtime = kategori denda: Rp100k/jam barang, Rp50k/jam kru (D4). */
export const PENALTY_CATEGORIES: PenaltyCategory[] = [
  'kerusakan',
  'kehilangan',
  'overtime',
  'lainnya',
];

/** Satu baris Dashboard Input Denda (API_CONTRACT §7). */
export class PenaltyItemInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  product_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  product_code!: string; // input bebas seperti sheet (bukan FK)

  @IsIn(PENALTY_CATEGORIES)
  category!: PenaltyCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  denda_per_qty!: number; // rupiah

  // denda_total DIHITUNG server (qty × denda_per_qty) — tidak diterima dari client
}

/** POST /orders/{code}/penalties — 1 denda per order (D14). */
export class CreatePenaltyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PenaltyItemInputDto)
  items!: PenaltyItemInputDto[];
}
