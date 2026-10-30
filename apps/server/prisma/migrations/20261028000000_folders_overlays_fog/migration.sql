-- Pastas da biblioteca, sobreposições de mapa e névoa (já estavam no schema.prisma sem migração)
-- CreateEnum
CREATE TYPE "FolderKind" AS ENUM ('SCENE', 'MAP', 'TOKEN', 'ITEM');

-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('CHARACTER', 'MONSTER', 'NPC', 'ITEM');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "category" TEXT,
ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "kind" "TokenKind" NOT NULL DEFAULT 'CHARACTER';

-- CreateTable
CREATE TABLE "AssetFolder" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kind" "FolderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapOverlay" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "folderId" TEXT,
    "assetId" TEXT,
    "imageUrl" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Mapa',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 1920,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 1080,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneFog" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "coverAll" BOOLEAN NOT NULL DEFAULT false,
    "revealedCells" JSONB NOT NULL DEFAULT '[]',
    "brushReveal" JSONB NOT NULL DEFAULT '[]',
    "brushHide" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneFog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetFolder_campaignId_kind_idx" ON "AssetFolder"("campaignId", "kind");

-- CreateIndex
CREATE INDEX "AssetFolder_parentId_idx" ON "AssetFolder"("parentId");

-- CreateIndex
CREATE INDEX "MapOverlay_sceneId_idx" ON "MapOverlay"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneFog_sceneId_key" ON "SceneFog"("sceneId");

-- CreateIndex
CREATE INDEX "Asset_folderId_idx" ON "Asset"("folderId");

-- CreateIndex
CREATE INDEX "Scene_folderId_idx" ON "Scene"("folderId");

-- AddForeignKey
ALTER TABLE "AssetFolder" ADD CONSTRAINT "AssetFolder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFolder" ADD CONSTRAINT "AssetFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapOverlay" ADD CONSTRAINT "MapOverlay_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneFog" ADD CONSTRAINT "SceneFog_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

