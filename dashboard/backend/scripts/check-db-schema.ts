import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    console.log('Checking database schema...');

    // Try to query the new table
    // We use $queryRaw because the Prisma Client might be old and not have the model typed yet
    try {
      const result =
        await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='AiChatSession';`;
      console.log('Table check result:', result);

      const columns = await prisma.$queryRaw`PRAGMA table_info(User);`;
      console.log('User columns:', columns);
    } catch (e) {
      console.error('Error querying database:', e);
    }
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
