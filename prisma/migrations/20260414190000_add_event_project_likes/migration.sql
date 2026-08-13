CREATE TABLE "EventProjectLike" (
    "id" TEXT NOT NULL,
    "eventProjectId" TEXT NOT NULL,
    "hackerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventProjectLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventProjectLike_eventProjectId_hackerId_key" ON "EventProjectLike"("eventProjectId", "hackerId");
CREATE INDEX "EventProjectLike_eventProjectId_idx" ON "EventProjectLike"("eventProjectId");
CREATE INDEX "EventProjectLike_hackerId_idx" ON "EventProjectLike"("hackerId");

ALTER TABLE "EventProjectLike"
ADD CONSTRAINT "EventProjectLike_eventProjectId_fkey"
FOREIGN KEY ("eventProjectId") REFERENCES "EventProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventProjectLike"
ADD CONSTRAINT "EventProjectLike_hackerId_fkey"
FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
