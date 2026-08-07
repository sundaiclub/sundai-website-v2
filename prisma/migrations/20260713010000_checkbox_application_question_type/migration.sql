-- Cut over the application-question JSON contract from BOOLEAN to CHECKBOX.
UPDATE "ApplicationTemplate"
SET "fieldsJson" = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN field->>'type' = 'BOOLEAN'
          THEN jsonb_set(field, '{type}', '"CHECKBOX"'::jsonb)
        ELSE field
      END
      ORDER BY position
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements("ApplicationTemplate"."fieldsJson")
    WITH ORDINALITY AS fields(field, position)
)
WHERE "fieldsJson" @> '[{"type":"BOOLEAN"}]'::jsonb;

UPDATE "Event"
SET "applicationQuestionsJson" = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN field->>'type' = 'BOOLEAN'
          THEN jsonb_set(field, '{type}', '"CHECKBOX"'::jsonb)
        ELSE field
      END
      ORDER BY position
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements("Event"."applicationQuestionsJson")
    WITH ORDINALITY AS fields(field, position)
)
WHERE "applicationQuestionsJson" @> '[{"type":"BOOLEAN"}]'::jsonb;

UPDATE "EventRegistration"
SET "templateSnapshotJson" = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN field->>'type' = 'BOOLEAN'
          THEN jsonb_set(field, '{type}', '"CHECKBOX"'::jsonb)
        ELSE field
      END
      ORDER BY position
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements("EventRegistration"."templateSnapshotJson")
    WITH ORDINALITY AS fields(field, position)
)
WHERE "templateSnapshotJson" @> '[{"type":"BOOLEAN"}]'::jsonb;
