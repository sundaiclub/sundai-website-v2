/*
  Warnings:

  - You are about to drop the column `weekId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `clerkId` on the `Hacker` table. All the data in the column will be lost.
  - You are about to drop the `Week` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AttendanceToProject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProjectToWeek` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `discordId` on table `Hacker` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_weekId_fkey";

-- DropForeignKey
ALTER TABLE "_AttendanceToProject" DROP CONSTRAINT "_AttendanceToProject_A_fkey";

-- DropForeignKey
ALTER TABLE "_AttendanceToProject" DROP CONSTRAINT "_AttendanceToProject_B_fkey";

-- DropForeignKey
ALTER TABLE "_ProjectToWeek" DROP CONSTRAINT "_ProjectToWeek_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProjectToWeek" DROP CONSTRAINT "_ProjectToWeek_B_fkey";

-- DropIndex
DROP INDEX "Attendance_weekId_idx";

-- DropIndex
DROP INDEX "Hacker_clerkId_key";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "weekId";

-- AlterTable
ALTER TABLE "Hacker" DROP COLUMN "clerkId",
ALTER COLUMN "discordId" SET NOT NULL;

-- DropTable
DROP TABLE "Week";

-- DropTable
DROP TABLE "_AttendanceToProject";

-- DropTable
DROP TABLE "_ProjectToWeek";
