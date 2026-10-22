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
  questionId: 'venue',
  locations: [{ id: 'bu', name: 'Boston University', answerValues: ['BU'] }],
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

it('loads current and historical choices for an MC', async () => {
  const response = await GET(
    createJsonRequest('/api/events/event-1/locations'),
    context
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    config: null,
    questions: [
      { id: 'venue', options: [{ value: 'Lowell' }, { value: 'BU' }] },
    ],
  });
  expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { eventId: 'event-1' } })
  );
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

it('rejects a question or answer from another event', async () => {
  expect(
    (
      await PATCH(
        request({ ...config, questionId: 'other-event-question' }),
        context
      )
    ).status
  ).toBe(400);
  expect(
    (
      await PATCH(
        request({
          ...config,
          locations: [
            { ...config.locations[0], answerValues: ['Unknown venue'] },
          ],
        }),
        context
      )
    ).status
  ).toBe(400);
  expect(prisma.event.update).not.toHaveBeenCalled();
});

it('rejects empty mappings and accepts removing all configured locations', async () => {
  expect(
    (
      await PATCH(
        request({
          ...config,
          locations: [{ ...config.locations[0], answerValues: [] }],
        }),
        context
      )
    ).status
  ).toBe(400);
  expect(
    (await PATCH(request({ ...config, locations: [] }), context)).status
  ).toBe(200);
});
