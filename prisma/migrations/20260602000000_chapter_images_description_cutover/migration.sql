ALTER TABLE "Chapter" ADD COLUMN "heroImageId" TEXT;

ALTER TABLE "Chapter" DROP COLUMN "defaultDeclineMessage";

CREATE UNIQUE INDEX "Chapter_heroImageId_key" ON "Chapter"("heroImageId");

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_heroImageId_fkey"
  FOREIGN KEY ("heroImageId")
  REFERENCES "Image"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
