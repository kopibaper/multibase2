-- AlterTable
ALTER TABLE "Instance" ADD COLUMN "environment" TEXT;

-- CreateTable
CREATE TABLE "CustomDomain" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_dns',
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReadReplica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "lagBytes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadReplica_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogDrain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "services" TEXT NOT NULL DEFAULT '[]',
    "format" TEXT NOT NULL DEFAULT 'json',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" TEXT,
    "lastDelivery" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LogDrain_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomDomain_instanceName_idx" ON "CustomDomain"("instanceName");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_instanceName_domain_key" ON "CustomDomain"("instanceName", "domain");

-- CreateIndex
CREATE INDEX "ReadReplica_instanceId_idx" ON "ReadReplica"("instanceId");

-- CreateIndex
CREATE INDEX "LogDrain_instanceId_idx" ON "LogDrain"("instanceId");
