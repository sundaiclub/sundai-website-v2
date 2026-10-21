-- Subscriber profiles can exist before their owners register with Clerk.
ALTER TABLE "Hacker" ALTER COLUMN "clerkId" DROP NOT NULL;
