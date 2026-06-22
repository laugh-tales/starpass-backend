-- Add referralCode to Creator (auto-generated unique code)
ALTER TABLE "creators" ADD COLUMN "referral_code" TEXT NOT NULL DEFAULT '';
-- backfill existing rows with a unique value based on id
UPDATE "creators" SET "referral_code" = substring(replace(gen_random_uuid()::text, '-', ''), 1, 12) WHERE "referral_code" = '';
-- Add unique constraint
CREATE UNIQUE INDEX "creators_referral_code_key" ON "creators"("referral_code");

-- Add referredBy to Pass (creator's referral code at time of purchase)
ALTER TABLE "passes" ADD COLUMN "referred_by" TEXT;
