const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking UptimeRecords...');
    const count = await prisma.uptimeRecord.count();
    console.log('Total Records:', count);

    const last = await prisma.uptimeRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    console.log('Last 5 Records:');
    console.log(JSON.stringify(last, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
