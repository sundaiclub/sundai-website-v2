import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import { GET, PATCH } from '@/app/api/events/[eventId]/locations/route';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn(), update: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    eventStaff: { findFirst: jest.fn() },
    eventRegistration: { findMany: jest.fn() },
  },
}));
const prisma = require('@/lib/prisma').default;
const fields = [
  {
    id: 'venue',
    label: 'Venue',
    type: 'SELECT',
    options: [{ value: 'Lowell', label: 'Lowell' }],
  },
];
const config = {
  locations: [{ id: 'bu', name: 'Boston University' }],
};
const context = createRouteContext({ eventId: 'event-1' });
const request = (body: unknown) =>
  createJsonRequest('/api/events/event-1/locations', { method: 'PATCH', body });

beforeEach(() => {
  jest.resetAllMocks();
  resetClerkMocks();
  mockAuthenticatedClerk({ userId: 'clerk-mc' });
  prisma.hacker.findUnique.mockResolvedValue({ id: 'mc', role: 'HACKER' });
  prisma.event.findUnique.mockResolvedValue({
    id: 'event-1',
    chapterId: 'chapter-1',
    applicationQuestionsJson: fields,
    communicationLocationsJson: null,
  });
  prisma.chapterMembership.findFirst.mockResolvedValue(null);
  prisma.eventStaff.findFirst.mockResolvedValue({ role: 'MC' });
  prisma.eventRegistration.findMany.mockResolvedValue([
    { answersJson: { venue: 'BU' }, templateSnapshotJson: fields },
  ]);
});

it('loads independent locations without reading application answers', async () => {
  const response = await GET(
    createJsonRequest('/api/events/event-1/locations'),
    context
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ config: null });
  expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
});

it.each(['MC', 'SITE_ADMIN', 'CHAPTER_ADMIN'])(
  'lets %s save independent message locations without changing application questions',
  async role => {
    if (role === 'SITE_ADMIN')
      prisma.hacker.findUnique.mockResolvedValue({ id: 'admin', role });
    if (role === 'CHAPTER_ADMIN')
      prisma.chapterMembership.findFirst.mockResolvedValue({
        role,
        status: 'ACTIVE',
      });
    const response = await PATCH(request(config), context);
    expect(response.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { communicationLocationsJson: config },
    });
  }
);

it.each(['CO_MC', null])('denies a non-editor (%s)', async role => {
  prisma.eventStaff.findFirst.mockResolvedValue(role ? { role } : null);
  expect((await PATCH(request(config), context)).status).toBe(403);
  expect(prisma.event.update).not.toHaveBeenCalled();
});

it('accepts any location name even when the application has no location choices', async () => {
  prisma.event.findUnique.mockResolvedValue({
    id: 'event-1',
    chapterId: 'chapter-1',
    applicationQuestionsJson: null,
  });
  expect((await PATCH(request(config), context)).status).toBe(200);
  expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
});

it('rejects blank or duplicate names and accepts removing all locations', async () => {
  expect(
    (await PATCH(request({ locations: [{ id: 'blank', name: ' ' }] }), context))
      .status
  ).toBe(400);
  expect(
    (
      await PATCH(
        request({
          locations: [
            config.locations[0],
            { id: 'duplicate', name: ' Boston University ' },
          ],
        }),
        context
      )
    ).status
  ).toBe(400);
  expect((await PATCH(request({ locations: [] }), context)).status).toBe(200);
});
