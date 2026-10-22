-- Cut over message locations to an independent list of names. Keep location
-- IDs so existing drafts and communication history retain their selection.
UPDATE "Event"
SET "communicationLocationsJson" = jsonb_build_object(
  'locations', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', location->'id', 'name', location->'name') ORDER BY position)
    FROM jsonb_array_elements("communicationLocationsJson"->'locations') WITH ORDINALITY AS entries(location, position)
  ), '[]'::jsonb)
)
WHERE "communicationLocationsJson" IS NOT NULL;
