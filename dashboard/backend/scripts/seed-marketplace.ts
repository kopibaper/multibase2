/**
 * Seed script: populates the Extension table with all official extensions.
 * Run via: npx ts-node scripts/seed-marketplace.ts
 * Safe to run multiple times — uses upsert logic.
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { MARKETPLACE_EXTENSIONS } from '../src/data/marketplace-extensions';

dotenv.config();

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/multibase.db';
  const dbPath = path.resolve(dbUrl.replace(/^file:/, ''));
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter } as any);
}

const prisma = createPrismaClient();

async function main() {
  console.log('Seeding extension marketplace...');
  let created = 0;
  let updated = 0;

  for (const ext of MARKETPLACE_EXTENSIONS) {
    const existing = await prisma.extension.findUnique({ where: { id: ext.id as string } });
    if (existing) {
      await prisma.extension.update({ where: { id: ext.id as string }, data: ext });
      console.log(`  ↻ Updated: ${ext.name}`);
      updated++;
    } else {
      await prisma.extension.create({ data: ext });
      console.log(`  + Created: ${ext.name}`);
      created++;
    }
  }

  console.log(`\nDone! Created ${created}, updated ${updated} extensions.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
