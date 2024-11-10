/*
  Warnings:

  - You are about to alter the column `preview` on the `Project` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.

*/
-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "preview" SET DATA TYPE VARCHAR(120);
