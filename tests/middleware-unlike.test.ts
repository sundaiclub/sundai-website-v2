jest.mock('@clerk/nextjs/server', () => ({
  authMiddleware: jest.fn(),
}))
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: any, init?: any) => ({ body, init })),
  },
}))
const { afterAuthHandler } = require('../src/middleware')

describe('Middleware unlike', () => {
  it('allows DELETE on like route without admin', async () => {
    const req: any = {
      nextUrl: {
        pathname: '/api/projects/123/like',
        origin: 'http://localhost:3000',
      },
      method: 'DELETE',
      clone: () => ({ json: async () => ({}) }) as any,
    }
    const auth: any = { userId: 'clerk_1' }
    const res = await afterAuthHandler(auth, req)
    expect(res).toBeUndefined() // no blocking response
  })
})


