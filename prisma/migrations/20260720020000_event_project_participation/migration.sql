-- Event participation is independent from pitch-queue participation.
CREATE TABLE "EventProject" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "addedById" TEXT NOT NULL,
  "cardStatus" "EventProjectCardStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventProject_pkey" PRIMARY KEY ("id")
);

-- Preserve every existing pitch-linked event project. If an event has more
-- than one pitch session, the oldest queue entry supplies the initial card state.
INSERT INTO "EventProject" (
  "id", "eventId", "projectId", "addedById", "cardStatus", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (session."eventId", entry."projectId")
  gen_random_uuid()::text,
  session."eventId",
  entry."projectId",
  entry."addedById",
  entry."cardStatus",
  entry."createdAt",
  entry."updatedAt"
FROM "PitchProject" entry
JOIN "PitchSession" session ON session."id" = entry."pitchSessionId"
WHERE session."eventId" IS NOT NULL
ORDER BY session."eventId", entry."projectId", entry."createdAt", entry."id";

CREATE UNIQUE INDEX "EventProject_eventId_projectId_key"
  ON "EventProject"("eventId", "projectId");
CREATE INDEX "EventProject_eventId_cardStatus_idx"
  ON "EventProject"("eventId", "cardStatus");
CREATE INDEX "EventProject_projectId_idx" ON "EventProject"("projectId");
CREATE INDEX "EventProject_addedById_idx" ON "EventProject"("addedById");

ALTER TABLE "EventProject"
  ADD CONSTRAINT "EventProject_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventProject"
  ADD CONSTRAINT "EventProject_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventProject"
  ADD CONSTRAINT "EventProject_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PitchProject" DROP COLUMN "cardStatus";
