-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('rental', 'expendable', 'catering', 'crew', 'location');

-- CreateEnum
CREATE TYPE "PricingBasis" AS ENUM ('per_day_unit', 'per_unit', 'per_package', 'per_person_day');

-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('brand', 'universal', 'category_utama', 'sub_category');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('percent', 'nominal');

-- CreateTable
CREATE TABLE "code_segments" (
    "id" UUID NOT NULL,
    "segment_type" "SegmentType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "code_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "category_utama_code" TEXT NOT NULL,
    "sub_category_code" TEXT NOT NULL,
    "code_number" INTEGER NOT NULL,
    "base_price" INTEGER NOT NULL,
    "pricing_basis" "PricingBasis" NOT NULL,
    "unit_label" TEXT NOT NULL,
    "min_qty" INTEGER,
    "is_returnable" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stock_qty" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "category_utama_code" TEXT NOT NULL,
    "code_number" INTEGER NOT NULL,
    "bundle_price" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "product_id" UUID,
    "sku_name" TEXT NOT NULL,
    "sku_code" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "component_price" INTEGER NOT NULL,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "value" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "code_segments_segment_type_code_key" ON "code_segments"("segment_type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_type_is_active_idx" ON "products"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_code_key" ON "bundles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
