/*
  Warnings:

  - The values [NON_HACKER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'DRAFT';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('NOT_SET', 'NEWBIE', 'HACKER', 'LEADER', 'ADMIN');
ALTER TABLE "Hacker" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "blogUrl" TEXT,
ADD COLUMN     "is_broken" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_starred" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TechTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectDomains" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ProjectTechnologies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TechTag_name_key" ON "TechTag"("name");

-- CreateIndex
CREATE INDEX "TechTag_name_idx" ON "TechTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DomainTag_name_key" ON "DomainTag"("name");

-- CreateIndex
CREATE INDEX "DomainTag_name_idx" ON "DomainTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectDomains_AB_unique" ON "_ProjectDomains"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectDomains_B_index" ON "_ProjectDomains"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectTechnologies_AB_unique" ON "_ProjectTechnologies"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectTechnologies_B_index" ON "_ProjectTechnologies"("B");

-- AddForeignKey
ALTER TABLE "_ProjectDomains" ADD CONSTRAINT "_ProjectDomains_A_fkey" FOREIGN KEY ("A") REFERENCES "DomainTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectDomains" ADD CONSTRAINT "_ProjectDomains_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTechnologies" ADD CONSTRAINT "_ProjectTechnologies_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTechnologies" ADD CONSTRAINT "_ProjectTechnologies_B_fkey" FOREIGN KEY ("B") REFERENCES "TechTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
