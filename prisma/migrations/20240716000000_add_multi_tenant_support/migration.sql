-- Create Tenant model
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "logo_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "custom_domain" TEXT UNIQUE,
    "features" JSONB NOT NULL DEFAULT '{}',
    "fee_bps" INTEGER NOT NULL DEFAULT 250,
    "max_creators" INTEGER NOT NULL DEFAULT 1000,
    "max_passes_per_creator" INTEGER NOT NULL DEFAULT 100,
    "admin_email" TEXT,
    "support_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- Drop old unique constraints that will be replaced with tenant-scoped constraints
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_stellar_address_key";
ALTER TABLE "creators" DROP CONSTRAINT IF EXISTS "creators_user_id_key";
ALTER TABLE "creators" DROP CONSTRAINT IF EXISTS "creators_stellar_address_key";
ALTER TABLE "creators" DROP CONSTRAINT IF EXISTS "creators_email_key";
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_slug_key";
ALTER TABLE "fans" DROP CONSTRAINT IF EXISTS "fans_user_id_key";
ALTER TABLE "fans" DROP CONSTRAINT IF EXISTS "fans_stellar_address_key";
ALTER TABLE "fans" DROP CONSTRAINT IF EXISTS "fans_email_key";

-- Add tenant_id to users table
ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for users
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- Add tenant-scoped unique constraint for users
CREATE UNIQUE INDEX "users_tenant_id_stellar_address_key" ON "users"("tenant_id", "stellar_address");

-- Add tenant_id to creators table
ALTER TABLE "creators" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for creators
ALTER TABLE "creators" ADD CONSTRAINT "creators_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "creators_tenant_id_idx" ON "creators"("tenant_id");

-- Add tenant-scoped unique constraints for creators
CREATE UNIQUE INDEX "creators_tenant_id_user_id_key" ON "creators"("tenant_id", "user_id");
CREATE UNIQUE INDEX "creators_tenant_id_stellar_address_key" ON "creators"("tenant_id", "stellar_address");
CREATE INDEX "creators_tenant_id_email_key" ON "creators"("tenant_id", "email") WHERE "email" IS NOT NULL;

-- Add tenant_id to categories table
ALTER TABLE "categories" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for categories
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- Add tenant-scoped unique constraint for categories
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- Add tenant_id to fans table
ALTER TABLE "fans" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for fans
ALTER TABLE "fans" ADD CONSTRAINT "fans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "fans_tenant_id_idx" ON "fans"("tenant_id");

-- Add tenant-scoped unique constraints for fans
CREATE UNIQUE INDEX "fans_tenant_id_user_id_key" ON "fans"("tenant_id", "user_id");
CREATE UNIQUE INDEX "fans_tenant_id_stellar_address_key" ON "fans"("tenant_id", "stellar_address");
CREATE INDEX "fans_tenant_id_email_key" ON "fans"("tenant_id", "email") WHERE "email" IS NOT NULL;

-- Add tenant_id to tiers table
ALTER TABLE "tiers" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for tiers
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tiers_tenant_id_idx" ON "tiers"("tenant_id");

-- Add tenant_id to passes table
ALTER TABLE "passes" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for passes
ALTER TABLE "passes" ADD CONSTRAINT "passes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "passes_tenant_id_idx" ON "passes"("tenant_id");

-- Add tenant_id to earnings_records table
ALTER TABLE "earnings_records" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for earnings_records
ALTER TABLE "earnings_records" ADD CONSTRAINT "earnings_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "earnings_records_tenant_id_idx" ON "earnings_records"("tenant_id");

-- Add tenant_id to content_schedules table
ALTER TABLE "content_schedules" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for content_schedules
ALTER TABLE "content_schedules" ADD CONSTRAINT "content_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "content_schedules_tenant_id_idx" ON "content_schedules"("tenant_id");

-- Add tenant_id to notifications table
ALTER TABLE "notifications" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for notifications
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- Add tenant_id to waitlist_entries table
ALTER TABLE "waitlist_entries" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for waitlist_entries
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "waitlist_entries_tenant_id_idx" ON "waitlist_entries"("tenant_id");

-- Add tenant_id to blocks table
ALTER TABLE "blocks" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for blocks
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "blocks_tenant_id_idx" ON "blocks"("tenant_id");

-- Add tenant_id to creator_members table
ALTER TABLE "creator_members" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create foreign key for creator_members
ALTER TABLE "creator_members" ADD CONSTRAINT "creator_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "creator_members_tenant_id_idx" ON "creator_members"("tenant_id");

-- Insert default tenant
INSERT INTO "tenants" ("id", "name", "slug", "status", "fee_bps", "max_creators", "max_passes_per_creator", "features")
VALUES (
    gen_random_uuid()::text,
    'Default Tenant',
    'default',
    'ACTIVE',
    250,
    1000,
    100,
    '{}'
) ON CONFLICT ("slug") DO NOTHING;

-- Update existing users to use default tenant
UPDATE "users" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing creators to use default tenant
UPDATE "creators" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing categories to use default tenant
UPDATE "categories" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing fans to use default tenant
UPDATE "fans" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing tiers to use default tenant
UPDATE "tiers" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing passes to use default tenant
UPDATE "passes" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing earnings_records to use default tenant
UPDATE "earnings_records" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing content_schedules to use default tenant
UPDATE "content_schedules" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing notifications to use default tenant
UPDATE "notifications" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing waitlist_entries to use default tenant
UPDATE "waitlist_entries" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing blocks to use default tenant
UPDATE "blocks" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';

-- Update existing creator_members to use default tenant
UPDATE "creator_members" 
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenant_id" = '00000000-0000-0000-0000-000000000000';
