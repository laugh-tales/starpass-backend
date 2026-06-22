-- AlterTable: add featured and featuredOrder to Creator
ALTER TABLE "creators" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "creators" ADD COLUMN "featured_order" INTEGER;
