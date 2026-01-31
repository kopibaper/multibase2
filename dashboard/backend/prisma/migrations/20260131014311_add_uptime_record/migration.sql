-- AlterTable (commented out to fix duplicate column error)
-- ALTER TABLE "GlobalSettings" ADD COLUMN "app_url" TEXT;

-- CreateTable
CREATE TABLE "UptimeRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseTime" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UptimeRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UptimeRecord_instanceId_timestamp_idx" ON "UptimeRecord"("instanceId", "timestamp");
