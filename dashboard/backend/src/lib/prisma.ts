import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

// dotenv hier laden damit DATABASE_URL verfügbar ist bevor der Singleton erstellt wird
dotenv.config();

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/multibase.db';
  const dbPath = path.resolve(dbUrl.replace(/^file:/, ''));
  // Verzeichnis erstellen falls nicht vorhanden (Prisma 7 macht das nicht mehr automatisch)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter } as any);
}

// Singleton für die gesamte Anwendung
const prisma = createPrismaClient();

export { prisma, PrismaClient };
export default prisma;
