UPDATE "Hacker"
SET "phoneNumber" = CASE
  WHEN length(regexp_replace("phoneNumber", '[^0-9]', '', 'g')) = 10
    THEN '+1' || regexp_replace("phoneNumber", '[^0-9]', '', 'g')
  WHEN length(regexp_replace("phoneNumber", '[^0-9]', '', 'g')) = 11
    AND regexp_replace("phoneNumber", '[^0-9]', '', 'g') LIKE '1%'
    THEN '+' || regexp_replace("phoneNumber", '[^0-9]', '', 'g')
  ELSE "phoneNumber"
END
WHERE "phoneNumber" IS NOT NULL
  AND (
    length(regexp_replace("phoneNumber", '[^0-9]', '', 'g')) = 10
    OR (
      length(regexp_replace("phoneNumber", '[^0-9]', '', 'g')) = 11
      AND regexp_replace("phoneNumber", '[^0-9]', '', 'g') LIKE '1%'
    )
  );
