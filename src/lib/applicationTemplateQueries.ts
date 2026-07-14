import prisma from '@/lib/prisma';
import {
  ApplicationTemplateValidationError,
  composeApplicationFields,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import type {
  ApplicationTemplateScope,
  EntityId,
  MergedApplicationTemplate,
} from '@/types/event-management';

interface ApplicationTemplatePrismaRecord {
  id: EntityId;
  scope?: ApplicationTemplateScope | string;
  chapterId?: EntityId | null;
  fieldsJson: unknown;
  isActive?: boolean | null;
}

interface EventApplicationQuestionPrismaRecord {
  id: EntityId;
  chapterId?: EntityId | null;
  applicationQuestionsJson?: unknown;
  hideChapterDefaultQuestions?: boolean | null;
}

interface ApplicationTemplatePrismaClient {
  applicationTemplate: {
    findFirst(args: unknown): Promise<ApplicationTemplatePrismaRecord | null>;
  };
  event: {
    findUnique(
      args: unknown
    ): Promise<EventApplicationQuestionPrismaRecord | null>;
  };
}

interface FetchApplicationTemplateInput {
  scope: ApplicationTemplateScope;
  chapterId?: EntityId | null;
  prisma?: ApplicationTemplatePrismaClient;
}

interface FetchMergedApplicationTemplateInput {
  chapterId?: EntityId | null;
  eventId?: EntityId | null;
  prisma?: ApplicationTemplatePrismaClient;
}

async function fetchActiveApplicationTemplate(
  input: FetchApplicationTemplateInput
): Promise<ApplicationTemplatePrismaRecord | null> {
  const client = input.prisma ?? getApplicationTemplatePrismaClient();
  const where =
    input.scope === 'SITE'
      ? { scope: 'SITE', isActive: true }
      : {
          scope: 'CHAPTER',
          chapterId: input.chapterId,
          isActive: true,
        };

  return client.applicationTemplate.findFirst({
    where,
    orderBy: { updatedAt: 'desc' },
  });
}

function fetchActiveSiteApplicationTemplate(
  client?: ApplicationTemplatePrismaClient
): Promise<ApplicationTemplatePrismaRecord | null> {
  return fetchActiveApplicationTemplate({
    scope: 'SITE',
    prisma: client,
  });
}

function fetchActiveChapterApplicationTemplate(
  chapterId: EntityId,
  client?: ApplicationTemplatePrismaClient
): Promise<ApplicationTemplatePrismaRecord | null> {
  return fetchActiveApplicationTemplate({
    scope: 'CHAPTER',
    chapterId,
    prisma: client,
  });
}

async function fetchEventApplicationQuestionConfig(
  eventId: EntityId,
  client?: ApplicationTemplatePrismaClient
): Promise<EventApplicationQuestionPrismaRecord | null> {
  const prismaClient = client ?? getApplicationTemplatePrismaClient();

  return prismaClient.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      chapterId: true,
      applicationQuestionsJson: true,
      hideChapterDefaultQuestions: true,
    },
  });
}

export async function fetchMergedApplicationTemplate(
  input: FetchMergedApplicationTemplateInput = {}
): Promise<MergedApplicationTemplate> {
  const client = input.prisma ?? getApplicationTemplatePrismaClient();
  const eventConfig = input.eventId
    ? await fetchEventApplicationQuestionConfig(input.eventId, client)
    : null;
  const chapterId = input.chapterId ?? eventConfig?.chapterId ?? null;
  const siteTemplate = await fetchActiveSiteApplicationTemplate(client);

  if (!siteTemplate) {
    throw new ApplicationTemplateValidationError(
      [
        {
          code: 'SITE_REQUIRED_FIELD_MISSING',
          message: 'An active site application template is required.',
        },
      ],
      'Active site application template not found'
    );
  }

  const chapterTemplate = chapterId
    ? await fetchActiveChapterApplicationTemplate(chapterId, client)
    : null;
  const siteFields = parseTemplateFieldsJson(
    siteTemplate.fieldsJson,
    'siteTemplate.fieldsJson',
    { requireSiteRequiredFields: true }
  );
  const siteRequiredFields = siteFields.filter(field => field.siteRequired);
  const chapterFields = chapterTemplate
    ? parseTemplateFieldsJson(
        chapterTemplate.fieldsJson,
        'chapterTemplate.fieldsJson',
        {
          requiredSiteFields: siteRequiredFields,
          allowSiteRequiredFieldIds: false,
        }
      )
    : [];
  const eventFields = eventConfig?.applicationQuestionsJson
    ? parseTemplateFieldsJson(
        eventConfig.applicationQuestionsJson,
        'event.applicationQuestionsJson',
        {
          requiredSiteFields: siteRequiredFields,
          allowSiteRequiredFieldIds: false,
        }
      )
    : [];

  return {
    siteTemplateId: siteTemplate.id,
    chapterTemplateId: chapterTemplate?.id ?? null,
    eventId: eventConfig?.id ?? input.eventId ?? null,
    fields: composeApplicationFields({
      siteFields,
      chapterFields,
      eventFields,
      hideChapterDefaultQuestions: eventConfig?.hideChapterDefaultQuestions,
    }),
  };
}

function getApplicationTemplatePrismaClient(): ApplicationTemplatePrismaClient {
  return prisma as unknown as ApplicationTemplatePrismaClient;
}
