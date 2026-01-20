/*
  Warnings:

  - You are about to drop the column `customerId` on the `Organisation` table. All the data in the column will be lost.
  - You are about to drop the column `organisationClaimId` on the `Organisation` table. All the data in the column will be lost.
  - You are about to drop the `OrganisationClaim` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionClaim` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Organisation" DROP CONSTRAINT "Organisation_organisationClaimId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_organisationId_fkey";

-- DropIndex
DROP INDEX "Organisation_customerId_key";

-- DropIndex
DROP INDEX "Organisation_organisationClaimId_key";

-- AlterTable
ALTER TABLE "Organisation" DROP COLUMN "customerId",
DROP COLUMN "organisationClaimId";

-- DropTable
DROP TABLE "OrganisationClaim";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "SubscriptionClaim";

-- DropEnum
DROP TYPE "SubscriptionStatus";
