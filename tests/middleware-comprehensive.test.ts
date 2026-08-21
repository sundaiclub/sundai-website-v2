import React from 'react';

const mockProtect = jest.fn();
const mockClerkMiddleware = jest.fn(() => 'clerk-proxy');

jest.mock('@clerk/nextjs/server', () => ({
  auth: Object.assign(jest.fn(), { protect: mockProtect }),
  clerkMiddleware: mockClerkMiddleware,
}));

describe('Clerk proxy and page authorization', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('establishes Clerk context without deprecated path authorization', () => {
    const proxy = require('../src/proxy');

    expect(proxy.default).toBe('clerk-proxy');
    expect(mockClerkMiddleware).toHaveBeenCalledWith();
  });

  it('has the expected matcher configuration', () => {
    const proxy = require('../src/proxy');

    expect(proxy.config).toEqual({
      matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
    });
  });

  it('protects authenticated page groups in their server layout', async () => {
    const AuthenticatedPageLayout =
      require('../src/app/AuthenticatedPageLayout').default;
    const child = React.createElement('div', null, 'Protected content');

    const result = await AuthenticatedPageLayout({ children: child });

    expect(mockProtect).toHaveBeenCalledTimes(1);
    expect(result).toBe(child);
  });

  it.each([
    '../src/app/admin/layout',
    '../src/app/attendance/layout',
    '../src/app/guide/layout',
    '../src/app/hacker/layout',
    '../src/app/me/layout',
    '../src/app/news/layout',
    '../src/app/organizer/layout',
    '../src/app/weeks/layout',
  ])('%s uses the authenticated page layout', layoutPath => {
    const layout = require(layoutPath).default;
    const AuthenticatedPageLayout =
      require('../src/app/AuthenticatedPageLayout').default;

    expect(layout).toBe(AuthenticatedPageLayout);
  });
});
