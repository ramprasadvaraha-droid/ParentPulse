/*
  Warnings:

  - A unique constraint covering the columns `[room_id,bed_number]` on the table `students` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "students" ADD COLUMN     "bed_number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "students_room_id_bed_number_key" ON "students"("room_id", "bed_number");
