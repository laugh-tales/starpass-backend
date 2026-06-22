-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_on_creator" (
    "creator_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_on_creator_pkey" PRIMARY KEY ("creator_id","category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- AddForeignKey
ALTER TABLE "category_on_creator" ADD CONSTRAINT "category_on_creator_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_on_creator" ADD CONSTRAINT "category_on_creator_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed common categories
INSERT INTO "categories" ("id", "name", "slug") VALUES
    (gen_random_uuid(), 'Music', 'music'),
    (gen_random_uuid(), 'Art', 'art'),
    (gen_random_uuid(), 'Gaming', 'gaming'),
    (gen_random_uuid(), 'Education', 'education'),
    (gen_random_uuid(), 'Fitness', 'fitness'),
    (gen_random_uuid(), 'Podcast', 'podcast'),
    (gen_random_uuid(), 'Comedy', 'comedy'),
    (gen_random_uuid(), 'Technology', 'technology'),
    (gen_random_uuid(), 'Cooking', 'cooking'),
    (gen_random_uuid(), 'Sports', 'sports');
