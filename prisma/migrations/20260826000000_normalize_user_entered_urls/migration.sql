DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT *
    FROM (VALUES
      ('Hacker', 'githubUrl'),
      ('Hacker', 'twitterUrl'),
      ('Hacker', 'linkedinUrl'),
      ('Hacker', 'websiteUrl'),
      ('Project', 'githubUrl'),
      ('Project', 'demoUrl'),
      ('Project', 'blogUrl'),
      ('Event', 'meetingUrl'),
      ('Event', 'virtualUrl'),
      ('PitchSession', 'meetingUrl'),
      ('EventMaterial', 'externalUrl')
    ) AS targets(table_name, column_name)
  LOOP
    EXECUTE format(
      'UPDATE %I
       SET %I = ''https://'' || btrim(%I)
       WHERE %I IS NOT NULL
         AND btrim(%I) <> ''''
         AND btrim(%I) !~* ''^[a-z][a-z0-9+.-]*:''
         AND btrim(%I) !~ ''^[/]''
         AND btrim(%I) !~ ''[[:space:]]''',
      target.table_name,
      target.column_name,
      target.column_name,
      target.column_name,
      target.column_name,
      target.column_name,
      target.column_name,
      target.column_name
    );
  END LOOP;
END $$;
