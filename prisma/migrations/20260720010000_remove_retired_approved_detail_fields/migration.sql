UPDATE "Event"
SET "approvedDetailsJson" = (
  SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  FROM jsonb_each("Event"."approvedDetailsJson") AS entry
  WHERE lower(regexp_replace(entry.key, '[^a-zA-Z0-9]', '', 'g'))
    NOT IN ('doorcode', 'toolkiturl')
)
WHERE "approvedDetailsJson" IS NOT NULL
  AND jsonb_typeof("approvedDetailsJson") = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_object_keys("approvedDetailsJson") AS retired_key(key_name)
    WHERE lower(regexp_replace(key_name, '[^a-zA-Z0-9]', '', 'g'))
      IN ('doorcode', 'toolkiturl')
  );
