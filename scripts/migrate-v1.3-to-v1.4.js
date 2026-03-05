const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting migration v1.3 → v1.4: Creating Default Organisation...');

  // Find first admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
  });

  if (!admin) {
    console.log('⚠️  No admin user found. Skipping migration.');
    return;
  }

  console.log(`👤 Found admin user: ${admin.email} (${admin.id})`);

  // Check if default org already exists
  const existingOrg = await prisma.organisation.findUnique({ where: { slug: 'default' } });
  if (existingOrg) {
    console.log('ℹ️  Default organisation already exists, skipping creation.');
    return;
  }

  // Create default organisation
  const org = await prisma.organisation.create({
    data: {
      name: 'Default Organisation',
      slug: 'default',
      members: {
        create: { userId: admin.id, role: 'owner' },
      },
    },
  });
  console.log(`✅ Created organisation: ${org.name} (${org.id})`);

  // Assign all existing instances to this org
  const result = await prisma.instance.updateMany({
    where: { orgId: null },
    data: { orgId: org.id },
  });
  console.log(`✅ Assigned ${result.count} instances to Default Organisation`);

  console.log('🎉 Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
