-- Ensure every deployment has the required active site application template.
DO $$
DECLARE
  template_creator_id TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ApplicationTemplate"
    WHERE "scope" = 'SITE'
      AND "isActive" = true
  ) THEN
    RETURN;
  END IF;

  SELECT "id"
  INTO template_creator_id
  FROM "Hacker"
  WHERE lower("email") = lower('mandrew0987@gmail.com')
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF template_creator_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot create the default site application template: hacker mandrew0987@gmail.com was not found';
  END IF;

  INSERT INTO "ApplicationTemplate" (
    "id",
    "scope",
    "chapterId",
    "name",
    "fieldsJson",
    "isActive",
    "createdById",
    "createdAt",
    "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'SITE',
    NULL,
    'Default site application',
    '[
      {
        "id": "name",
        "label": "Name",
        "type": "TEXT",
        "required": true,
        "siteRequired": true,
        "order": 1
      },
      {
        "id": "email",
        "label": "Email",
        "type": "EMAIL",
        "required": true,
        "siteRequired": true,
        "order": 2
      }
    ]'::jsonb,
    true,
    template_creator_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
END $$;
