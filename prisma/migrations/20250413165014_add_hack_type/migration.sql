-- CreateEnum
CREATE TYPE "HackType" AS ENUM ('REGULAR', 'RESEARCH');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hack_type" "HackType" DEFAULT 'REGULAR';
