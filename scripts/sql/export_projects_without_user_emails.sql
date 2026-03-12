COPY (
  SELECT
    p.title,
    p.preview,
    p.description,
    p."githubUrl" AS github_url,
    p."demoUrl" AS demo_url,
    p."blogUrl" AS blog_url,
    p."startDate" AS project_start_date,
    p."endDate" AS project_end_date,
    launch_lead.name AS launch_lead_name,
    COALESCE(
      (
        SELECT string_agg(DISTINCT h.name, '; ' ORDER BY h.name)
        FROM "ProjectToParticipant" ptp
        JOIN "Hacker" h ON h.id = ptp."hackerId"
        WHERE ptp."projectId" = p.id
      ),
      ''
    ) AS participant_names,
    COALESCE(
      (
        SELECT string_agg(DISTINCT tt.name, '; ' ORDER BY tt.name)
        FROM "_ProjectTechnologies" rel
        JOIN "TechTag" tt ON tt.id = rel."B"
        WHERE rel."A" = p.id
      ),
      ''
    ) AS tech_tags,
    COALESCE(
      (
        SELECT string_agg(DISTINCT dt.name, '; ' ORDER BY dt.name)
        FROM "_ProjectDomains" rel
        JOIN "DomainTag" dt ON dt.id = rel."A"
        WHERE rel."B" = p.id
      ),
      ''
    ) AS domain_tags,
    (
      SELECT COUNT(*)
      FROM "ProjectLike" pl
      WHERE pl."projectId" = p.id
    )::int AS like_count,
    (
      SELECT img.url
      FROM "Image" img
      WHERE img.id = p."thumbnailId"
    ) AS thumbnail_url,
    COALESCE(
      (
        SELECT jsonb_agg(img.url ORDER BY img."createdAt")
        FROM "Image" img
        WHERE img."projectId" = p.id
      ),
      '[]'::jsonb
    ) AS image_urls
  FROM "Project" p
  JOIN "Hacker" launch_lead ON launch_lead.id = p."launchLeadId"
  ORDER BY p."createdAt" DESC
) TO STDOUT WITH (FORMAT csv, HEADER true);
