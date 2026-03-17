-- CreateTable
CREATE TABLE "Extension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "longDescription" TEXT,
    "version" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorUrl" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "iconUrl" TEXT,
    "screenshotUrls" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL,
    "minVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "requiresExtensions" TEXT,
    "installType" TEXT NOT NULL,
    "manifestUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstalledExtension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" TEXT,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstalledExtension_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstalledExtension_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Extension_category_idx" ON "Extension"("category");

-- CreateIndex
CREATE INDEX "Extension_featured_idx" ON "Extension"("featured");

-- CreateIndex
CREATE INDEX "InstalledExtension_instanceId_idx" ON "InstalledExtension"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledExtension_instanceId_extensionId_key" ON "InstalledExtension"("instanceId", "extensionId");
