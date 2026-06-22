-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "fan_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_fan_id_creator_id_key" ON "favorites"("fan_id", "creator_id");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_fan_id_fkey"
    FOREIGN KEY ("fan_id") REFERENCES "fans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_creator_id_fkey"
    FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
