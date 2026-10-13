DO $$
BEGIN
  IF EXISTS (
    SELECT LOWER(email)
    FROM "users"
    WHERE "role" IN ('ADMIN', 'SUPER_ADMIN')
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate platform-owner or institution-admin emails exist. Assign different emails before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "users_management_email_key"
ON "users" (LOWER("email"))
WHERE "role" IN ('ADMIN', 'SUPER_ADMIN');