-- AlterTable: add trialDays to Tier
ALTER TABLE "tiers" ADD COLUMN "trial_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add trialUsed to Pass
ALTER TABLE "passes" ADD COLUMN "trial_used" BOOLEAN NOT NULL DEFAULT false;
