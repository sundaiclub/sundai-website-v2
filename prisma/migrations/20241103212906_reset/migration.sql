/*
  Warnings:

  - You are about to drop the column `discordId` on the `Hacker` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clerkId]` on the table `Hacker` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `weekId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clerkId` to the `Hacker` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Hacker_discordId_key";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "weekId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Hacker" DROP COLUMN "discordId",
ADD COLUMN     "clerkId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectToWeek" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AttendanceToProject" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Week_startDate_endDate_idx" ON "Week"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Week_number_key" ON "Week"("number");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectToWeek_AB_unique" ON "_ProjectToWeek"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectToWeek_B_index" ON "_ProjectToWeek"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AttendanceToProject_AB_unique" ON "_AttendanceToProject"("A", "B");

-- CreateIndex
CREATE INDEX "_AttendanceToProject_B_index" ON "_AttendanceToProject"("B");

-- CreateIndex
CREATE INDEX "Attendance_weekId_idx" ON "Attendance"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "Hacker_clerkId_key" ON "Hacker"("clerkId");

-- CreateIndex
CREATE INDEX "Hacker_clerkId_idx" ON "Hacker"("clerkId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectToWeek" ADD CONSTRAINT "_ProjectToWeek_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectToWeek" ADD CONSTRAINT "_ProjectToWeek_B_fkey" FOREIGN KEY ("B") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttendanceToProject" ADD CONSTRAINT "_AttendanceToProject_A_fkey" FOREIGN KEY ("A") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttendanceToProject" ADD CONSTRAINT "_AttendanceToProject_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
