-- AlterTable: add soft-delete and cooling-off period fields to Fan
ALTER TABLE "fans" ADD COLUMN "deletion_scheduled_at" TIMESTAMP(3);
ALTER TABLE "fans" ADD COLUMN "deleted_at" TIMESTAMP(3);
