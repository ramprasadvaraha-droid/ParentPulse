/*
  Warnings:

  - A unique constraint covering the columns `[floor_id,name]` on the table `rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "floor_id" UUID,
ALTER COLUMN "block_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "floors_institution_id_idx" ON "floors"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "floors_institution_id_name_key" ON "floors"("institution_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "floors_institution_id_order_index_key" ON "floors"("institution_id", "order_index");

-- CreateIndex
CREATE INDEX "rooms_floor_id_idx" ON "rooms"("floor_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_floor_id_name_key" ON "rooms"("floor_id", "name");

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
