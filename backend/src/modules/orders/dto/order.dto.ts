import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  CatalogType,
  DeliverySlot,
  DpDisposition,
  OrderStatus,
  PaymentStatus,
} from '../../../generated/prisma/client';

export const CATALOG_TYPES: CatalogType[] = ['product', 'bundle'];
export const DELIVERY_SLOTS: DeliverySlot[] = ['pagi', 'siang', 'sore'];
export const DP_DISPOSITIONS: DpDisposition[] = [
  'refund_full',
  'forfeit',
  'partial',
  'none',
];
/** Via POST /status hanya on_progress/completed (API_CONTRACT §5.2); cancel lewat /cancel. */
export const CHANGEABLE_STATUSES: OrderStatus[] = ['on_progress', 'completed'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Identitas penyewa guest (D11) — disnapshot ke order. */
export class OrderCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;
}

/** Satu baris keranjang booking (API_CONTRACT §5.1). */
export class OrderItemInputDto {
  @IsIn(CATALOG_TYPES)
  catalog_type!: CatalogType;

  @IsString()
  @IsNotEmpty()
  code!: string; // kode produk/bundle katalog

  @Matches(ISO_DATE, { message: 'start_date harus format YYYY-MM-DD' })
  start_date!: string;

  @Matches(ISO_DATE, { message: 'end_date harus format YYYY-MM-DD' })
  end_date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsBoolean()
  is_discount?: boolean = false;

  @IsOptional()
  @IsIn(DELIVERY_SLOTS)
  delivery_slot?: DeliverySlot | null;
}

/** Body POST /orders — juga dipakai POST /orders/preview (body sama persis, D19). */
export class CreateOrderDto {
  // @IsDefined wajib: tanpa ini, @ValidateNested MELEWATKAN properti yang absen
  @IsDefined({ message: 'customer wajib diisi' })
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer!: OrderCustomerDto;

  @IsString()
  @IsNotEmpty()
  alamat_shooting!: string;

  @IsString()
  @IsNotEmpty()
  purpose!: string;

  @IsOptional()
  @IsString()
  promo_code?: string; // 1 voucher per order (D13); lookup case-insensitive (D25)

  @IsOptional()
  @IsBoolean()
  is_dp?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  deposit_percent?: number = 0;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];
}

/**
 * PATCH /orders/{code} — mirip Dashboard Update Pesanan: field yang dikirim
 * menggantikan nilai lama; `items` (bila dikirim) MENGGANTI seluruh baris;
 * `code` & `invoice_date` tetap. promo_code: null = hapus voucher.
 */
export class UpdateOrderDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer?: OrderCustomerDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  alamat_shooting?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  purpose?: string;

  @IsOptional()
  @IsString()
  promo_code?: string | null;

  @IsOptional()
  @IsBoolean()
  is_dp?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  deposit_percent?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items?: OrderItemInputDto[];
}

/** GET /orders?status=&payment=&q=&from=&to=&include=items (API_CONTRACT §5.2/D17). */
export class OrderListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'on_progress', 'completed', 'cancel'] as OrderStatus[])
  status?: OrderStatus;

  @IsOptional()
  @IsIn(['belum_lunas', 'sebagian', 'lunas'] as PaymentStatus[])
  payment?: PaymentStatus;

  @IsOptional()
  @IsString()
  q?: string; // cari kode order / nama penyewa

  @IsOptional()
  @Matches(ISO_DATE, { message: 'from harus format YYYY-MM-DD' })
  from?: string; // filter invoice_date ≥

  @IsOptional()
  @Matches(ISO_DATE, { message: 'to harus format YYYY-MM-DD' })
  to?: string; // filter invoice_date ≤

  @IsOptional()
  @IsIn(['items'])
  include?: 'items';
}

/** GET /orders/lookup?code=&phone= — cek status oleh customer (guest). */
export class OrderLookupQueryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;
}

/** POST /orders/{code}/status — on_progress/completed (admin boleh override). */
export class ChangeStatusDto {
  @IsIn(CHANGEABLE_STATUSES)
  status!: OrderStatus;
}

/** POST /orders/{code}/cancel — disposisi DP wajib ditentukan admin (D15). */
export class CancelOrderDto {
  @IsIn(DP_DISPOSITIONS)
  dp_disposition!: DpDisposition;
}
