CREATE TYPE "EventProjectVoteValue" AS ENUM ('LIKE', 'DISLIKE');

ALTER TABLE "EventProjectLike" RENAME TO "EventProjectVote";

ALTER TABLE "EventProjectVote"
ADD COLUMN "value" "EventProjectVoteValue" NOT NULL DEFAULT 'LIKE',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EventProjectVote" ALTER COLUMN "value" DROP DEFAULT;

ALTER TABLE "EventProjectVote" RENAME CONSTRAINT "EventProjectLike_pkey" TO "EventProjectVote_pkey";

ALTER INDEX "EventProjectLike_eventProjectId_hackerId_key" RENAME TO "EventProjectVote_eventProjectId_hackerId_key";
ALTER INDEX "EventProjectLike_eventProjectId_idx" RENAME TO "EventProjectVote_eventProjectId_idx";
ALTER INDEX "EventProjectLike_hackerId_idx" RENAME TO "EventProjectVote_hackerId_idx";

ALTER TABLE "EventProjectVote" RENAME CONSTRAINT "EventProjectLike_eventProjectId_fkey" TO "EventProjectVote_eventProjectId_fkey";
ALTER TABLE "EventProjectVote" RENAME CONSTRAINT "EventProjectLike_hackerId_fkey" TO "EventProjectVote_hackerId_fkey";
