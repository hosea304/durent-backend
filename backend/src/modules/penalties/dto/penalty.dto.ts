import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
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
/** Batas atas defensif — cegah overflow hitung & payload raksasa. */
const MAX_QTY = 1_000_000;
const MAX_RUPIAH = 1_000_000_000;
const MAX_ITEMS = 100;

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
  @Max(MAX_QTY)
  qty!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RUPIAH)
  denda_per_qty!: number; // rupiah

  // denda_total DIHITUNG server (qty × denda_per_qty) — tidak diterima dari client
}

/** POST /orders/{code}/penalties — 1 denda per order (D14). */
export class CreatePenaltyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PenaltyItemInputDto)
  items!: PenaltyItemInputDto[];
}
