/*
  Warnings:

  - You are about to drop the column `checkInTime` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `checkOutTime` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the `_AttendanceToProject` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[hackerId,weekId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- DropForeignKey
ALTER TABLE "_AttendanceToProject" DROP CONSTRAINT "_AttendanceToProject_A_fkey";

-- DropForeignKey
ALTER TABLE "_AttendanceToProject" DROP CONSTRAINT "_AttendanceToProject_B_fkey";

-- DropIndex
DROP INDEX "Attendance_date_idx";

-- DropIndex
DROP INDEX "Attendance_hackerId_date_key";

-- DropIndex
DROP INDEX "Attendance_hackerId_idx";

-- DropIndex
DROP INDEX "Attendance_weekId_idx";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "checkInTime",
DROP COLUMN "checkOutTime",
DROP COLUMN "date",
DROP COLUMN "duration",
DROP COLUMN "location",
DROP COLUMN "notes",
DROP COLUMN "verified",
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "_AttendanceToProject";

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_hackerId_weekId_key" ON "Attendance"("hackerId", "weekId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
