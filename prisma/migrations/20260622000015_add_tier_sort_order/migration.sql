-- AlterTable: add sort_order to tiers
ALTER TABLE "tiers" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
