import type { TemplateFieldDefinition } from '../../src/types/event-management';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerkUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildSiteAdmin,
} from '../utils/event-management-fixtures';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    chapter: {
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
    },
    applicationTemplate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (operation: unknown) => {
      if (Array.isArray(operation)) {
        return Promise.all(operation);
      }

      return operation;
    }),
  },
}));

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

const mockPrisma = require('../../src/lib/prisma').default;
const {
  GET: GET_MERGED_TEMPLATE,
} = require('../../src/app/api/application-templates/merged/route');
const {
  POST: POST_APPLICATION_TEMPLATE,
} = require('../../src/app/api/application-templates/route');
const {
  PATCH: PATCH_APPLICATION_TEMPLATE,
  DELETE: DELETE_APPLICATION_TEMPLATE,
} = require('../../src/app/api/application-templates/[templateId]/route');

const siteRequiredFields: TemplateFieldDefinition[] = [
  {
    id: 'name',
    label: 'Name',
    type: 'TEXT',
    required: true,
    siteRequired: true,
    order: 0,
  },
  {
    id: 'email',
    label: 'Email',
    type: 'EMAIL',
    required: true,
    siteRequired: true,
    order: 1,
  },
];

const chapterQuestion: TemplateFieldDefinition = {
  id: 'dietaryNeeds',
  label: 'Dietary needs',
  type: 'TEXTAREA',
  required: false,
  order: 0,
};

function signInAs(hacker: { clerkId: string; email: string | null }) {
  mockAuthenticatedClerkUser(
    { userId: hacker.clerkId },
    {
      id: hacker.clerkId,
      primaryEmailAddress: {
        id: `${hacker.clerkId}-email`,
        emailAddress: hacker.email ?? `${hacker.clerkId}@example.com`,
      },
    }
  );
}

describe('/api/application-templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('creates a site application template as a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const createdTemplate = {
      id: 'template-site-v2',
      scope: 'SITE',
      chapterId: null,
      name: 'Site application v2',
      fieldsJson: siteRequiredFields,
      isActive: true,
      createdById: siteAdmin.id,
      createdAt: new Date('2026-05-25T12:00:00.000Z'),
      updatedAt: new Date('2026-05-25T12:00:00.000Z'),
    };

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.applicationTemplate.create.mockResolvedValue(createdTemplate);

    const response = await POST_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates', {
        method: 'POST',
        body: {
          scope: 'SITE',
          name: 'Site application v2',
          fieldsJson: siteRequiredFields,
          isActive: true,
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.applicationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'SITE',
          chapterId: null,
          name: 'Site application v2',
          fieldsJson: expect.arrayContaining([
            expect.objectContaining({ id: 'name', siteRequired: true }),
            expect.objectContaining({ id: 'email', siteRequired: true }),
          ]),
          isActive: true,
          createdById: siteAdmin.id,
        }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ id: createdTemplate.id }));
  });

  it('allows a chapter admin to create a template for their chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const createdTemplate = {
      id: 'template-chapter-boston',
      scope: 'CHAPTER',
      chapterId: chapter.id,
      name: 'Boston application',
      fieldsJson: [chapterQuestion],
      isActive: true,
      createdById: hacker.id,
      createdAt: new Date('2026-05-25T12:00:00.000Z'),
      updatedAt: new Date('2026-05-25T12:00:00.000Z'),
    };

    signInAs(hacker);
    mockPrisma.hacker.findUnique.mockResolvedValue(hacker);
    mockPrisma.chapter.findUnique.mockResolvedValue(chapter);
    mockPrisma.chapterMembership.findFirst.mockResolvedValue(membership);
    mockPrisma.applicationTemplate.create.mockResolvedValue(createdTemplate);

    const response = await POST_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates', {
        method: 'POST',
        body: {
          scope: 'CHAPTER',
          chapterId: chapter.id,
          name: 'Boston application',
          fieldsJson: [chapterQuestion],
          isActive: true,
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.applicationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'CHAPTER',
          chapterId: chapter.id,
          fieldsJson: expect.arrayContaining([
            expect.objectContaining({ id: 'dietaryNeeds' }),
          ]),
          createdById: hacker.id,
        }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ id: createdTemplate.id }));
  });

  it('rejects site templates that remove site-required fields', async () => {
    const siteAdmin = buildSiteAdmin();

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);

    const response = await POST_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates', {
        method: 'POST',
        body: {
          scope: 'SITE',
          name: 'Broken site application',
          fieldsJson: [siteRequiredFields[0]],
          isActive: true,
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockPrisma.applicationTemplate.create).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'SITE_REQUIRED_FIELD_MISSING',
            fieldId: 'email',
          }),
        ]),
      })
    );
  });
});

describe('/api/application-templates/[templateId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('updates a site template when site-required fields remain intact', async () => {
    const siteAdmin = buildSiteAdmin();
    const existingTemplate = {
      id: 'template-site-active',
      scope: 'SITE',
      chapterId: null,
      name: 'Site application',
      fieldsJson: siteRequiredFields,
      isActive: true,
      createdById: siteAdmin.id,
    };
    const updatedFields = [
      ...siteRequiredFields,
      {
        id: 'githubUrl',
        label: 'GitHub URL',
        type: 'URL',
        required: false,
        order: 2,
      } satisfies TemplateFieldDefinition,
    ];
    const updatedTemplate = {
      ...existingTemplate,
      name: 'Site application updated',
      fieldsJson: updatedFields,
    };

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.applicationTemplate.findUnique.mockResolvedValue(
      existingTemplate
    );
    mockPrisma.applicationTemplate.update.mockResolvedValue(updatedTemplate);

    const response = await PATCH_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-site-active', {
        method: 'PATCH',
        body: {
          name: 'Site application updated',
          fieldsJson: updatedFields,
        },
      }),
      createRouteContext({ templateId: existingTemplate.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.applicationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existingTemplate.id },
        data: expect.objectContaining({
          name: 'Site application updated',
          fieldsJson: expect.arrayContaining([
            expect.objectContaining({ id: 'name', siteRequired: true }),
            expect.objectContaining({ id: 'email', siteRequired: true }),
            expect.objectContaining({ id: 'githubUrl' }),
          ]),
        }),
      })
    );
    expect(body).toEqual(
      expect.objectContaining({
        id: existingTemplate.id,
        fieldsJson: expect.arrayContaining([
          expect.objectContaining({ id: 'name', siteRequired: true }),
          expect.objectContaining({ id: 'email', siteRequired: true }),
          expect.objectContaining({ id: 'githubUrl' }),
        ]),
      })
    );
  });

  it('updates a chapter template as that chapter admin', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const existingTemplate = {
      id: 'template-chapter-boston',
      scope: 'CHAPTER',
      chapterId: chapter.id,
      name: 'Boston application',
      fieldsJson: [chapterQuestion],
      isActive: true,
      createdById: hacker.id,
    };
    const updatedQuestion = {
      ...chapterQuestion,
      label: 'Dietary needs and accessibility notes',
      required: true,
    };
    const updatedTemplate = {
      ...existingTemplate,
      name: 'Boston application updated',
      fieldsJson: [updatedQuestion],
    };

    signInAs(hacker);
    mockPrisma.hacker.findUnique.mockResolvedValue(hacker);
    mockPrisma.chapterMembership.findFirst.mockResolvedValue(membership);
    mockPrisma.applicationTemplate.findUnique.mockResolvedValue(
      existingTemplate
    );
    mockPrisma.applicationTemplate.update.mockResolvedValue(updatedTemplate);

    const response = await PATCH_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-chapter-boston', {
        method: 'PATCH',
        body: {
          name: 'Boston application updated',
          fieldsJson: [updatedQuestion],
        },
      }),
      createRouteContext({ templateId: existingTemplate.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.applicationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existingTemplate.id },
        data: expect.objectContaining({
          name: 'Boston application updated',
          fieldsJson: expect.arrayContaining([
            expect.objectContaining({
              id: 'dietaryNeeds',
              required: true,
            }),
          ]),
        }),
      })
    );
    expect(body).toEqual(
      expect.objectContaining({
        id: existingTemplate.id,
        chapterId: chapter.id,
        fieldsJson: expect.arrayContaining([
          expect.objectContaining({ id: 'dietaryNeeds', required: true }),
        ]),
      })
    );
  });

  it('rejects updates that weaken a site-required field', async () => {
    const siteAdmin = buildSiteAdmin();
    const existingTemplate = {
      id: 'template-site-active',
      scope: 'SITE',
      chapterId: null,
      name: 'Site application',
      fieldsJson: siteRequiredFields,
      isActive: true,
      createdById: siteAdmin.id,
    };
    const weakenedFields = [
      { ...siteRequiredFields[0], required: false },
      siteRequiredFields[1],
    ];

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.applicationTemplate.findUnique.mockResolvedValue(
      existingTemplate
    );

    const response = await PATCH_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-site-active', {
        method: 'PATCH',
        body: {
          fieldsJson: weakenedFields,
        },
      }),
      createRouteContext({ templateId: existingTemplate.id })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockPrisma.applicationTemplate.update).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'SITE_REQUIRED_FIELD_WEAKENED',
            fieldId: 'name',
          }),
        ]),
      })
    );
  });

  it('rejects chapter updates that try to override site-required fields', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const existingTemplate = {
      id: 'template-chapter-boston',
      scope: 'CHAPTER',
      chapterId: chapter.id,
      name: 'Boston application',
      fieldsJson: [chapterQuestion],
      isActive: true,
      createdById: hacker.id,
    };

    signInAs(hacker);
    mockPrisma.hacker.findUnique.mockResolvedValue(hacker);
    mockPrisma.chapterMembership.findFirst.mockResolvedValue(membership);
    mockPrisma.applicationTemplate.findUnique.mockResolvedValue(
      existingTemplate
    );

    const response = await PATCH_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-chapter-boston', {
        method: 'PATCH',
        body: {
          fieldsJson: [
            {
              id: 'email',
              label: 'Preferred email',
              type: 'EMAIL',
              required: false,
            },
          ],
        },
      }),
      createRouteContext({ templateId: existingTemplate.id })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockPrisma.applicationTemplate.update).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'SITE_REQUIRED_FIELD_OVERRIDE',
            fieldId: 'email',
          }),
        ]),
      })
    );
  });

  it('deletes a chapter template as that chapter admin', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const existingTemplate = {
      id: 'template-chapter-boston',
      scope: 'CHAPTER',
      chapterId: chapter.id,
      isActive: true,
    };

    signInAs(hacker);
    mockPrisma.hacker.findUnique.mockResolvedValue(hacker);
    mockPrisma.chapterMembership.findFirst.mockResolvedValue(membership);
    mockPrisma.applicationTemplate.findUnique.mockResolvedValue(
      existingTemplate
    );
    mockPrisma.applicationTemplate.delete.mockResolvedValue(existingTemplate);

    const response = await DELETE_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-chapter-boston', {
        method: 'DELETE',
      }),
      createRouteContext({ templateId: existingTemplate.id })
    );

    expect(response.status).toBe(204);
    expect(mockPrisma.applicationTemplate.delete).toHaveBeenCalledWith({
      where: { id: existingTemplate.id },
    });
  });

  it('rejects deletion of the active site template base', async () => {
    const siteAdmin = buildSiteAdmin();
    const existingTemplate = {
      id: 'template-site-active',
      scope: 'SITE',
      chapterId: null,
      isActive: true,
    };

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.applicationTemplate.findUnique.mockResolvedValue(
      existingTemplate
    );

    const response = await DELETE_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-site-active', {
        method: 'DELETE',
      }),
      createRouteContext({ templateId: existingTemplate.id })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockPrisma.applicationTemplate.delete).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        message: expect.stringMatching(/base for all chapters/i),
      })
    );
  });
});

describe('/api/application-templates/merged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('returns site-required fields with chapter defaults for a site admin preview', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter();

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.applicationTemplate.findFirst
      .mockResolvedValueOnce({
        id: 'template-site-active',
        scope: 'SITE',
        chapterId: null,
        fieldsJson: siteRequiredFields,
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: 'template-chapter-boston',
        scope: 'CHAPTER',
        chapterId: chapter.id,
        fieldsJson: [chapterQuestion],
        isActive: true,
      });

    const response = await GET_MERGED_TEMPLATE(
      createJsonRequest('/api/application-templates/merged', {
        searchParams: { chapterId: chapter.id },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        siteTemplateId: 'template-site-active',
        chapterTemplateId: 'template-chapter-boston',
        fields: [
          expect.objectContaining({ id: 'name', siteRequired: true }),
          expect.objectContaining({ id: 'email', siteRequired: true }),
          expect.objectContaining({ id: 'dietaryNeeds' }),
        ],
      })
    );
  });
});
