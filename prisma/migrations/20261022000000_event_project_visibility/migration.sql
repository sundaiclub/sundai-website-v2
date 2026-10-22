ALTER TABLE "Event" ADD COLUMN "projectsHidden" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Event" SET "projectsHidden" = true WHERE "judgingEnabled" = true;
