-- Tahap 3: orders + order_items (DATA_MODEL §3.5–3.6)
-- SQL dihasilkan via `prisma migrate diff` (DB Supabase sedang paused saat build);
-- diterapkan dengan `prisma migrate dev` setelah DB resume.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'on_progress', 'completed', 'cancel');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('belum_lunas', 'sebagian', 'lunas');

-- CreateEnum
CREATE TYPE "DpDisposition" AS ENUM ('refund_full', 'forfeit', 'partial', 'none');

-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('product', 'bundle');

-- CreateEnum
CREATE TYPE "DeliverySlot" AS ENUM ('pagi', 'siang', 'sore');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "code_number" INTEGER NOT NULL,
    "invoice_date" DATE NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "alamat_shooting" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "promo_code" TEXT,
    "is_dp" BOOLEAN NOT NULL DEFAULT false,
    "deposit_percent" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL,
    "deposit_amount" INTEGER NOT NULL,
    "total_with_deposit" INTEGER NOT NULL,
    "status_transaksi" "OrderStatus" NOT NULL DEFAULT 'pending',
    "status_pembayaran" "PaymentStatus" NOT NULL DEFAULT 'belum_lunas',
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "dp_disposition" "DpDisposition",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "catalog_type" "CatalogType" NOT NULL,
    "product_id" UUID,
    "bundle_id" UUID,
    "item_name" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "duration" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "rental_total" INTEGER NOT NULL,
    "is_discount" BOOLEAN NOT NULL DEFAULT false,
    "discount_percent" INTEGER,
    "discount_amount" INTEGER,
    "sub_total" INTEGER NOT NULL,
    "delivery_slot" "DeliverySlot",
    "picked_up_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_number_key" ON "orders"("code_number");

-- CreateIndex
CREATE INDEX "orders_status_transaksi_idx" ON "orders"("status_transaksi");

-- CreateIndex
CREATE INDEX "orders_invoice_date_idx" ON "orders"("invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_line_no_key" ON "order_items"("order_id", "line_no");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promo_code_fkey" FOREIGN KEY ("promo_code") REFERENCES "vouchers"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
