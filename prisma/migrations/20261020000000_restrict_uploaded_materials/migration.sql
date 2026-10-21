UPDATE "EventMaterial"
SET "visibility" = 'APPROVED_ATTENDEES', "updatedAt" = CURRENT_TIMESTAMP
WHERE "kind" = 'FILE' AND "visibility" = 'PUBLIC';

ALTER TABLE "EventMaterial"
ADD CONSTRAINT "EventMaterial_file_visibility_check"
CHECK ("kind" <> 'FILE' OR "visibility" <> 'PUBLIC');
