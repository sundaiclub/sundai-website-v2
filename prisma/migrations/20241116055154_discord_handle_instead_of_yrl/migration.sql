/*
  Warnings:

  - You are about to drop the column `discordUrl` on the `Hacker` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Hacker" DROP COLUMN "discordUrl",
ADD COLUMN     "discordName" TEXT;
