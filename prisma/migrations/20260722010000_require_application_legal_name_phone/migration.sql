-- Cut over all site application templates to collect the applicant's legal name
-- and phone number. Existing custom fields remain unchanged.
ALTER TABLE "Hacker"
  ADD COLUMN "smsConsentAt" TIMESTAMP(3),
  ADD COLUMN "smsConsentVersion" TEXT;

UPDATE "ApplicationTemplate"
SET
  "fieldsJson" = (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'id' = 'name' THEN
          field || '{"label":"Full legal name","type":"TEXT","required":true,"siteRequired":true}'::jsonb
        WHEN field->>'id' = 'email' THEN
          field || '{"type":"EMAIL","required":true,"siteRequired":true}'::jsonb
        ELSE field
      END
      ORDER BY ordinal
    ) || CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements("ApplicationTemplate"."fieldsJson") existing
        WHERE existing->>'id' = 'phoneNumber'
      ) THEN '[]'::jsonb
      ELSE '[{
        "id": "phoneNumber",
        "label": "Phone number",
        "type": "PHONE",
        "required": true,
        "siteRequired": true,
        "helpText": "By submitting your phone number, you consent to receive recurring automated text messages from Sundai about event applications and updates. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.",
        "placeholder": "+1 555 123 4567",
        "order": 3
      }]'::jsonb
    END
    FROM jsonb_array_elements("ApplicationTemplate"."fieldsJson")
      WITH ORDINALITY AS fields(field, ordinal)
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "scope" = 'SITE';

-- Normalize an existing phone field if a site template already has one.
UPDATE "ApplicationTemplate"
SET
  "fieldsJson" = (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'id' = 'phoneNumber' THEN
          field || '{
            "label": "Phone number",
            "type": "PHONE",
            "required": true,
            "siteRequired": true,
            "helpText": "By submitting your phone number, you consent to receive recurring automated text messages from Sundai about event applications and updates. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.",
            "placeholder": "+1 555 123 4567"
          }'::jsonb
        ELSE field
      END
      ORDER BY ordinal
    )
    FROM jsonb_array_elements("ApplicationTemplate"."fieldsJson")
      WITH ORDINALITY AS fields(field, ordinal)
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "scope" = 'SITE';
