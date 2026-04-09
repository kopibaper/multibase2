import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- Connecting to Database ---');
    await prisma.$connect();

    // 1. Update all instances to RUNNING to ensure UptimeService checks them
    console.log('\n--- Updating Instance Statuses ---');
    const updateResult = await prisma.instance.updateMany({
      data: { status: 'running' },
    });
    console.log(`Updated ${updateResult.count} instances to 'running' status.`);

    // 2. Simulate logic for limit-test-3-clone
    const name = 'limit-test-3-clone';
    console.log(`\n--- Debugging Instance: ${name} ---`);

    // Lookup by Name
    const instance = await prisma.instance.findUnique({
      where: { name },
    });

    if (!instance) {
      console.error(`ERROR: Instance '${name}' NOT found in DB!`);
      return;
    }

    console.log(`Found Instance:`);
    console.log(`  ID: ${instance.id}`);
    console.log(`  Name: ${instance.name}`);
    console.log(`  Status: ${instance.status}`);

    // Query Records using ID
    console.log('\n--- Querying Uptime Records ---');
    const count = await prisma.uptimeRecord.count({
      where: { instanceId: instance.id },
    });
    console.log(`Found ${count} records for ID ${instance.id}`);

    if (count > 0) {
      const latest = await prisma.uptimeRecord.findFirst({
        where: { instanceId: instance.id },
        orderBy: { timestamp: 'desc' },
      });
      console.log('Latest Record:', latest);
    } else {
      console.warn('No records found for this ID.');
    }

    // 3. Insert a TEST record (UP)
    console.log('\n--- Inserting Manual Verification Record ---');
    const newRecord = await prisma.uptimeRecord.create({
      data: {
        instanceId: instance.id,
        status: 'up',
        responseTime: 50,
        timestamp: new Date(),
      },
    });
    console.log('Inserted UP record:', newRecord);
    console.log('Checking again should show it.');
  } catch (e) {
    console.error('Script Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
