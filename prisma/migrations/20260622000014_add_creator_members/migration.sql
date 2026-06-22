-- CreateEnum: CreatorMemberRole
CREATE TYPE "CreatorMemberRole" AS ENUM ('OWNER', 'EDITOR');

-- CreateTable: CreatorMember
CREATE TABLE "creator_members" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "role" "CreatorMemberRole" NOT NULL DEFAULT 'EDITOR',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creator_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_members_creator_id_address_key" ON "creator_members"("creator_id", "address");

ALTER TABLE "creator_members"
  ADD CONSTRAINT "creator_members_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
