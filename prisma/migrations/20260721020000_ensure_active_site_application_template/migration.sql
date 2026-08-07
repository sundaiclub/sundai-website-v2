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
    SELECT "id"
    INTO template_creator_id
    FROM "Hacker"
    WHERE "role" = 'SITE_ADMIN'
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1;
  END IF;

  IF template_creator_id IS NULL THEN
    INSERT INTO "Hacker" (
      "id",
      "clerkId",
      "name",
      "role",
      "createdAt",
      "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      'system_default_site_application_template_creator',
      'System application template creator',
      'NOT_SET',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("clerkId") DO NOTHING;

    SELECT "id"
    INTO template_creator_id
    FROM "Hacker"
    WHERE "clerkId" = 'system_default_site_application_template_creator';
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
