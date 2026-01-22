/*
  Warnings:

  - The values [GOOGLE,OIDC] on the enum `IdentityProvider` will be removed. If these variants are still used in the database, this will fail.
  - The values [PASSKEY_CREATED,PASSKEY_DELETED,PASSKEY_UPDATED,SIGN_IN_PASSKEY_FAIL] on the enum `UserSecurityAuditLogType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Passkey` table. If the table is not empty, all the data it contains will be lost.

*/
-- Update existing User records with GOOGLE or OIDC identityProvider to DOCUMENSO
UPDATE "User" SET "identityProvider" = 'DOCUMENSO' WHERE "identityProvider" IN ('GOOGLE', 'OIDC');

-- Delete UserSecurityAuditLog records with passkey-related types
DELETE FROM "UserSecurityAuditLog" WHERE "type" IN ('PASSKEY_CREATED', 'PASSKEY_DELETED', 'PASSKEY_UPDATED', 'SIGN_IN_PASSKEY_FAIL');

-- AlterEnum
BEGIN;
CREATE TYPE "IdentityProvider_new" AS ENUM ('DOCUMENSO');
ALTER TABLE "public"."User" ALTER COLUMN "identityProvider" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "identityProvider" TYPE "IdentityProvider_new" USING ("identityProvider"::text::"IdentityProvider_new");
ALTER TYPE "IdentityProvider" RENAME TO "IdentityProvider_old";
ALTER TYPE "IdentityProvider_new" RENAME TO "IdentityProvider";
DROP TYPE "public"."IdentityProvider_old";
ALTER TABLE "User" ALTER COLUMN "identityProvider" SET DEFAULT 'DOCUMENSO';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserSecurityAuditLogType_new" AS ENUM ('ACCOUNT_PROFILE_UPDATE', 'ACCOUNT_SSO_LINK', 'ACCOUNT_SSO_UNLINK', 'ORGANISATION_SSO_LINK', 'ORGANISATION_SSO_UNLINK', 'AUTH_2FA_DISABLE', 'AUTH_2FA_ENABLE', 'PASSWORD_RESET', 'PASSWORD_UPDATE', 'SESSION_REVOKED', 'SIGN_OUT', 'SIGN_IN', 'SIGN_IN_FAIL', 'SIGN_IN_2FA_FAIL');
ALTER TABLE "UserSecurityAuditLog" ALTER COLUMN "type" TYPE "UserSecurityAuditLogType_new" USING ("type"::text::"UserSecurityAuditLogType_new");
ALTER TYPE "UserSecurityAuditLogType" RENAME TO "UserSecurityAuditLogType_old";
ALTER TYPE "UserSecurityAuditLogType_new" RENAME TO "UserSecurityAuditLogType";
DROP TYPE "public"."UserSecurityAuditLogType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Passkey" DROP CONSTRAINT "Passkey_userId_fkey";

-- DropTable
DROP TABLE "Passkey";
