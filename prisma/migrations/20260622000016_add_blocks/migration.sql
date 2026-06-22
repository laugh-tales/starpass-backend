-- CreateTable: Block
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "fan_address" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blocks_creator_id_fan_address_key" ON "blocks"("creator_id", "fan_address");

ALTER TABLE "blocks"
  ADD CONSTRAINT "blocks_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
