/*
  Warnings:

  - You are about to drop the column `residentId` on the `Envelope` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Envelope" DROP COLUMN "residentId",
ADD COLUMN     "ownerId" UUID;
