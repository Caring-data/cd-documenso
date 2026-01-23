-- DropColumn
ALTER TABLE "User" DROP COLUMN IF EXISTS "identityProvider";

-- DropEnum
DROP TYPE IF EXISTS "IdentityProvider";
