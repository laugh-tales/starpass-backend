-- CreateTable: ContentSchedule
CREATE TABLE "content_schedules" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "content_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "available_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "content_schedules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "content_schedules"
  ADD CONSTRAINT "content_schedules_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_schedules"
  ADD CONSTRAINT "content_schedules_tier_id_fkey"
  FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
