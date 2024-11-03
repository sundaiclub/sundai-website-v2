/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `Hacker` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Project` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[avatarId]` on the table `Hacker` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[thumbnailId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `launchLeadId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'NOT_SET';

-- AlterTable
ALTER TABLE "Hacker" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarId" TEXT;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "imageUrl",
ADD COLUMN     "launchLeadId" TEXT NOT NULL,
ADD COLUMN     "thumbnailId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Hacker_avatarId_key" ON "Hacker"("avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_thumbnailId_key" ON "Project"("thumbnailId");

-- CreateIndex
CREATE INDEX "Project_launchLeadId_idx" ON "Project"("launchLeadId");

-- AddForeignKey
ALTER TABLE "Hacker" ADD CONSTRAINT "Hacker_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_launchLeadId_fkey" FOREIGN KEY ("launchLeadId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
