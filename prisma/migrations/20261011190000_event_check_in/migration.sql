-- AlterTable
ALTER TABLE "Event" DROP COLUMN "checkInClosesAt",
DROP COLUMN "checkInOpensAt",
ADD COLUMN     "trackAttendance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "checkInToken" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInById" TEXT;

-- Backfill an unguessable check-in token for existing registrations.
UPDATE "EventRegistration" SET "checkInToken" = gen_random_uuid()::text WHERE "checkInToken" IS NULL;

ALTER TABLE "EventRegistration" ALTER COLUMN "checkInToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_checkInToken_key" ON "EventRegistration"("checkInToken");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_status_checkedInAt_idx" ON "EventRegistration"("eventId", "status", "checkedInAt");

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
