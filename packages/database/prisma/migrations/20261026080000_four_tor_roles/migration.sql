-- Replace the two starter roles with the four roles of TOR section 2.
--
-- Postgres cannot remove an enum value that existing rows still use, so the old type is renamed,
-- the new one created, and the column recast with an explicit mapping. Existing demo rows are
-- carried over rather than dropped, so this applies to a populated clone as well as a fresh one.
--   ADMIN -> ADMINISTRATOR
--   STAFF -> STORE_EMPLOYEE

ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR', 'PURCHASING_OFFICER', 'STORE_EMPLOYEE', 'MANAGER');

-- The default references the old type and has to go before the column can be recast.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"::text
      WHEN 'ADMIN' THEN 'ADMINISTRATOR'
      WHEN 'STAFF' THEN 'STORE_EMPLOYEE'
      ELSE 'STORE_EMPLOYEE'
    END
  )::"Role";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STORE_EMPLOYEE';

DROP TYPE "Role_old";
