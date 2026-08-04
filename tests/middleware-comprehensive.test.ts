jest.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: jest.fn((handler: unknown) => handler),
  createRouteMatcher: jest.fn(() => jest.fn(() => false)),
}));

describe('middleware', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('keeps public project reads available for signed-out visitors', () => {
    require('../src/middleware');
    const { createRouteMatcher } = require('@clerk/nextjs/server');

    expect(createRouteMatcher).toHaveBeenCalledWith(
      expect.arrayContaining(['/api/projects(.*)'])
    );
  });

  it('keeps the Clerk webhook public', () => {
    require('../src/middleware');
    const { createRouteMatcher } = require('@clerk/nextjs/server');

    expect(createRouteMatcher).toHaveBeenCalledWith(
      expect.arrayContaining(['/api/webhooks/clerk'])
    );
  });

  it('keeps the legal pages public', () => {
    require('../src/middleware');
    const { createRouteMatcher } = require('@clerk/nextjs/server');

    expect(createRouteMatcher).toHaveBeenCalledWith(
      expect.arrayContaining(['/privacy', '/terms'])
    );
  });

  it('protects routes that are not public', async () => {
    const middleware = require('../src/middleware').default;
    const protect = jest.fn();
    const auth = jest.fn(() => ({ protect }));

    await middleware(auth, { nextUrl: { pathname: '/admin' } });

    expect(protect).toHaveBeenCalledTimes(1);
  });

  it('has the expected matcher configuration', () => {
    const middleware = require('../src/middleware');

    expect(middleware.config).toEqual({
      matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
    });
  });
});
