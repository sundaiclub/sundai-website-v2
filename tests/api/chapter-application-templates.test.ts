import type { TemplateFieldDefinition } from '../../src/types/event-management';
import {
  POST as POST_APPLICATION_TEMPLATE,
  GET as GET_APPLICATION_TEMPLATES,
} from '../../src/app/api/application-templates/route';
import { PATCH as PATCH_APPLICATION_TEMPLATE } from '../../src/app/api/application-templates/[templateId]/route';
import { PATCH as PATCH_CHAPTER } from '../../src/app/api/chapters/[chapterId]/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  type ChapterMembershipFixture,
  type HackerFixture,
} from '../utils/event-management-fixtures';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    chapter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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
    eventStaff: {
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;

const projectIdeaQuestion: TemplateFieldDefinition = {
  id: 'projectIdea',
  label: 'What do you want to build?',
  type: 'TEXTAREA',
  required: true,
  order: 0,
};

const availabilityQuestion: TemplateFieldDefinition = {
  id: 'availability',
  label: 'Can you stay for demos?',
  type: 'BOOLEAN',
  required: false,
  order: 1,
};

const mockHackerLookup = (...hackers: HackerFixture[]) => {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    return (
      hackers.find(
        hacker => where?.id === hacker.id || where?.clerkId === hacker.clerkId
      ) ?? null
    );
  });
};

const mockActor = (actor: HackerFixture, ...extraHackers: HackerFixture[]) => {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockCurrentUser({
    id: actor.clerkId,
    primaryEmailAddress: actor.email
      ? { id: `${actor.id}-email`, emailAddress: actor.email }
      : null,
  });
  mockHackerLookup(actor, ...extraHackers);
};

const mockMembershipLookup = (...memberships: ChapterMembershipFixture[]) => {
  const findMembership = ({ where }: any) => {
    if (where?.id) {
      return memberships.find(membership => membership.id === where.id) ?? null;
    }

    const compound = where?.chapterId_hackerId;
    const chapterId = compound?.chapterId ?? where?.chapterId;
    const hackerId = compound?.hackerId ?? where?.hackerId;
    const role = typeof where?.role === 'string' ? where.role : undefined;
    const status = typeof where?.status === 'string' ? where.status : undefined;

    return (
      memberships.find(membership => {
        if (chapterId && membership.chapterId !== chapterId) return false;
        if (hackerId && membership.hackerId !== hackerId) return false;
        if (role && membership.role !== role) return false;
        if (status && membership.status !== status) return false;
        return true;
      }) ?? null
    );
  };

  prisma.chapterMembership.findFirst.mockImplementation(async (args: any) =>
    findMembership(args)
  );
  prisma.chapterMembership.findUnique.mockImplementation(async (args: any) =>
    findMembership(args)
  );
};

describe('chapter-admin application template operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('lists active site templates and local chapter templates for a chapter admin', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const templates = [
      {
        id: 'template-site-active',
        scope: 'SITE',
        chapterId: null,
        name: 'Site application',
        fieldsJson: [],
        isActive: true,
      },
      {
        id: 'template-chapter-boston',
        scope: 'CHAPTER',
        chapterId: chapter.id,
        name: 'Boston application',
        fieldsJson: [projectIdeaQuestion],
        isActive: true,
      },
    ];

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.applicationTemplate.findMany.mockResolvedValue(templates);

    const response = await GET_APPLICATION_TEMPLATES(
      createJsonRequest('/api/application-templates', {
        searchParams: { chapterId: chapter.id },
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.applicationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ scope: 'SITE', isActive: true }, { chapterId: chapter.id }],
        },
      })
    );
    expect(body).toEqual(templates);
  });

  it('creates a chapter-scoped application template for the admin chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const createdTemplate = {
      id: 'template-chapter-boston-v2',
      scope: 'CHAPTER',
      chapterId: chapter.id,
      name: 'Boston event application',
      fieldsJson: [projectIdeaQuestion, availabilityQuestion],
      isActive: true,
      createdById: hacker.id,
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.applicationTemplate.create.mockResolvedValue(createdTemplate);

    const response = await POST_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates', {
        method: 'POST',
        body: {
          scope: 'CHAPTER',
          chapterId: chapter.id,
          name: 'Boston event application',
          fieldsJson: [projectIdeaQuestion, availabilityQuestion],
          isActive: true,
        },
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(prisma.applicationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'CHAPTER',
          chapterId: chapter.id,
          name: 'Boston event application',
          fieldsJson: expect.arrayContaining([
            expect.objectContaining({ id: 'projectIdea' }),
            expect.objectContaining({ id: 'availability' }),
          ]),
          createdById: hacker.id,
        }),
      })
    );
    expect(body).toMatchObject({
      id: 'template-chapter-boston-v2',
      scope: 'CHAPTER',
      chapterId: chapter.id,
    });
  });

  it('updates a chapter-scoped application template for the admin chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const existingTemplate = {
      id: 'template-chapter-boston',
      scope: 'CHAPTER',
      chapterId: chapter.id,
    };
    const updatedTemplate = {
      ...existingTemplate,
      name: 'Boston application defaults',
      fieldsJson: [{ ...projectIdeaQuestion, required: false }],
      isActive: true,
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.applicationTemplate.findUnique.mockResolvedValue(existingTemplate);
    prisma.applicationTemplate.update.mockResolvedValue(updatedTemplate);

    const response = await PATCH_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-chapter-boston', {
        method: 'PATCH',
        body: {
          name: 'Boston application defaults',
          fieldsJson: updatedTemplate.fieldsJson,
          isActive: true,
        },
      }) as any,
      createRouteContext({ templateId: existingTemplate.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.applicationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existingTemplate.id },
        data: expect.objectContaining({
          name: 'Boston application defaults',
          isActive: true,
          fieldsJson: expect.arrayContaining([
            expect.objectContaining({ id: 'projectIdea', required: false }),
          ]),
        }),
      })
    );
    expect(body).toMatchObject({
      id: existingTemplate.id,
      chapterId: chapter.id,
      name: 'Boston application defaults',
    });
  });

  it('lets a chapter admin edit the chapter description for their chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const description =
      'Local builders, demos, and application defaults for Sundai Boston.';
    const updatedChapter = buildChapter({
      ...chapter,
      description,
    });

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapter.update.mockResolvedValue(updatedChapter);

    const response = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston', {
        method: 'PATCH',
        body: { description },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        data: { description },
      })
    );
    expect(body).toMatchObject({
      id: chapter.id,
      description,
    });
  });

  it('denies chapter template and description edits outside the admin chapter', async () => {
    const { hacker, membership: bostonAdminMembership } =
      buildChapterAdminFixture();
    const nycChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const nycTemplate = {
      id: 'template-chapter-nyc',
      scope: 'CHAPTER',
      chapterId: nycChapter.id,
    };

    mockActor(hacker);
    mockMembershipLookup(bostonAdminMembership);
    prisma.chapter.findUnique.mockResolvedValue(nycChapter);
    prisma.applicationTemplate.findUnique.mockResolvedValue(nycTemplate);

    const createResponse = await POST_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates', {
        method: 'POST',
        body: {
          scope: 'CHAPTER',
          chapterId: nycChapter.id,
          name: 'NYC application',
          fieldsJson: [projectIdeaQuestion],
        },
      }) as any
    );
    const updateResponse = await PATCH_APPLICATION_TEMPLATE(
      createJsonRequest('/api/application-templates/template-chapter-nyc', {
        method: 'PATCH',
        body: { name: 'Unauthorized NYC template edit' },
      }) as any,
      createRouteContext({ templateId: nycTemplate.id }) as any
    );
    const descriptionResponse = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-nyc', {
        method: 'PATCH',
        body: { description: 'Unauthorized NYC description edit.' },
      }) as any,
      createRouteContext({ chapterId: nycChapter.id }) as any
    );

    expect(createResponse.status).toBe(403);
    expect(updateResponse.status).toBe(403);
    expect(descriptionResponse.status).toBe(403);
    expect(prisma.applicationTemplate.create).not.toHaveBeenCalled();
    expect(prisma.applicationTemplate.update).not.toHaveBeenCalled();
    expect(prisma.chapter.update).not.toHaveBeenCalled();
  });
});
