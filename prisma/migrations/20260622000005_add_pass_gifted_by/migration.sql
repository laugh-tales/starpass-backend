-- AlterTable: add giftedBy to Pass (nullable Stellar address of the sender)
ALTER TABLE "passes" ADD COLUMN "gifted_by" TEXT;
