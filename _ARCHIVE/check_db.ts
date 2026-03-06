import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('Checking instances...');
    const instances = await prisma.instance.findMany();
    console.log(
      `Found ${instances.length} instances:`,
      instances.map((i) => `${i.name} (${i.status})`)
    );

    console.log('\nChecking uptime records...');
    const count = await prisma.uptimeRecord.count();
    console.log(`Total uptime records: ${count}`);

    if (count > 0) {
      const records = await prisma.uptimeRecord.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: { instance: true },
      });
      console.log(
        '\nLatest 5 records:',
        records.map((r) => ({
          instance: r.instance.name,
          status: r.status,
          time: r.timestamp.toISOString(),
        }))
      );
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
