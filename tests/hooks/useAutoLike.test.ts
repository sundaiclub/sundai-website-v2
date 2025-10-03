import { renderHook, act } from '@testing-library/react'
import React from 'react'

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (k: string) => (k === 'like' ? '1' : null),
    entries: () => new Map().entries(),
  }),
  useRouter: () => ({ replace: jest.fn() }),
}))

const clerk = { useUser: jest.fn(() => ({ isLoaded: true, isSignedIn: true })) }
jest.mock('@clerk/nextjs', () => clerk)

describe('useAutoLike', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
    sessionStorage.clear()
  })

  it('likes project on mount when like=1 and signed in', async () => {
    const { useAutoLike } = require('../../src/app/hooks/useAutoLike')
    await act(async () => { renderHook(() => useAutoLike('p1')) })

    expect(fetch).toHaveBeenCalledWith('/api/projects/p1/like', { method: 'POST' })
  })

  it('does not like when not signed in (would open sign-in)', async () => {
    clerk.useUser.mockReturnValue({ isLoaded: true, isSignedIn: false, openSignIn: jest.fn() })
    const { useAutoLike } = require('../../src/app/hooks/useAutoLike')
    await act(async () => { renderHook(() => useAutoLike('p1')) })
    expect(fetch).not.toHaveBeenCalled()
  })
})


