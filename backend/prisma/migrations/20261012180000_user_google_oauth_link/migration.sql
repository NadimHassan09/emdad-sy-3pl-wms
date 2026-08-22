-- Optional Google Sign-In link for existing users (no auto-provisioning).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_linked_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_key" ON "users"("google_sub");
