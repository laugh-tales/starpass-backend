-- CreateTable: Waitlist for sold-out tiers
CREATE TABLE "waitlists" (
    "id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "fan_address" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "waitlists_pkey" PRIMARY KEY ("id")
);

-- UniqueConstraint: one entry per fan per tier
CREATE UNIQUE INDEX "waitlists_tier_id_fan_address_key" ON "waitlists"("tier_id", "fan_address");

-- ForeignKey
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
