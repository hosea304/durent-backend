-- CreateEnum
CREATE TYPE "PenaltyCategory" AS ENUM ('kerusakan', 'kehilangan', 'overtime', 'lainnya');

-- CreateTable
CREATE TABLE "penalties" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "invoice_date" DATE NOT NULL,
    "grand_total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_items" (
    "id" UUID NOT NULL,
    "penalty_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "category" "PenaltyCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "denda_per_qty" INTEGER NOT NULL,
    "denda_total" INTEGER NOT NULL,

    CONSTRAINT "penalty_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "penalties_code_key" ON "penalties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "penalties_order_id_key" ON "penalties"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_items_penalty_id_line_no_key" ON "penalty_items"("penalty_id", "line_no");

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_items" ADD CONSTRAINT "penalty_items_penalty_id_fkey" FOREIGN KEY ("penalty_id") REFERENCES "penalties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
