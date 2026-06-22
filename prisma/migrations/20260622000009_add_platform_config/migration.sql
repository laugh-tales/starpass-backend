-- CreateTable: PlatformConfig singleton row for platform-wide fee
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "fee_bps" INTEGER NOT NULL DEFAULT 250,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- Seed default row
INSERT INTO "platform_config" ("id", "fee_bps", "updated_at") VALUES ('singleton', 250, NOW()) ON CONFLICT DO NOTHING;
