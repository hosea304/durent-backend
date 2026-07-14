import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentKind } from '../../../generated/prisma/client';

export const PAYMENT_KINDS: PaymentKind[] = ['dp', 'pelunasan', 'refund'];

/** POST /orders/{code}/payments — baris ledger baru (API_CONTRACT §6). */
export class CreatePaymentDto {
  @IsIn(PAYMENT_KINDS)
  kind!: PaymentKind;

  @Type(() => Number)
  @IsInt()
  @Min(1)
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
