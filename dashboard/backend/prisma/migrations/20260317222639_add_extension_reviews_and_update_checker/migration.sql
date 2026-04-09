-- AlterTable
ALTER TABLE "Extension" ADD COLUMN "latestVersion" TEXT;

-- CreateTable
CREATE TABLE "ExtensionReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extensionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtensionReview_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExtensionReview_extensionId_idx" ON "ExtensionReview"("extensionId");
