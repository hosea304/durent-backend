import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentKind } from '../../../generated/prisma/client';

export const PAYMENT_KINDS: PaymentKind[] = ['dp', 'pelunasan', 'refund'];
/** Batas atas defensif rupiah per baris (cegah overflow) — jauh di atas nilai order nyata. */
const MAX_RUPIAH = 1_000_000_000;

/** POST /orders/{code}/payments — baris ledger baru (API_CONTRACT §6). */
export class CreatePaymentDto {
  @IsIn(PAYMENT_KINDS)
  kind!: PaymentKind;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RUPIAH)
  amount!: number; // rupiah positif; refund pun positif (dikurangkan saat derivasi, D26)

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'paid_date harus format YYYY-MM-DD',
  })
  paid_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
