-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Instance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "basePort" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "orgId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Instance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Instance" ("basePort", "createdAt", "id", "name", "orgId", "status", "updatedAt") SELECT "basePort", "createdAt", "id", "name", "orgId", "status", "updatedAt" FROM "Instance";
DROP TABLE "Instance";
ALTER TABLE "new_Instance" RENAME TO "Instance";
CREATE UNIQUE INDEX "Instance_name_key" ON "Instance"("name");
CREATE INDEX "Instance_name_idx" ON "Instance"("name");
CREATE INDEX "Instance_status_idx" ON "Instance"("status");
CREATE INDEX "Instance_orgId_idx" ON "Instance"("orgId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
