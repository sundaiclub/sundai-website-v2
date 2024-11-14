-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SPONSOR';

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "preview" DROP NOT NULL;
