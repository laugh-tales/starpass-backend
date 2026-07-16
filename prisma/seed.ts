import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  'Music',
  'Art',
  'Gaming',
  'Education',
  'Fitness',
  'Technology',
  'Writing',
  'Photography',
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  // Create default tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Tenant',
      slug: 'default',
      status: 'ACTIVE',
      feeBps: 250,
      maxCreators: 1000,
      maxPassesPerCreator: 100,
      features: {},
    },
  });

  // Create categories for default tenant
  for (const name of categories) {
    const slug = slugify(name);
    await prisma.category.upsert({
      where: { 
        tenantId_slug: {
          tenantId: defaultTenant.id,
          slug,
        },
      },
      update: { name },
      create: { 
        name, 
        slug,
        tenantId: defaultTenant.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });