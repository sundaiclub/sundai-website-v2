// Mock @google/genai SDK for this test
const generateContentMock = jest.fn()
jest.mock('@google/genai', () => ({
  __esModule: true,
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
}))

import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/news/generate/route'

describe('/api/news/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns original body when no instruction provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({ htmlBody: '<div>hello</div>' })
    } as any)
    const res = await POST(req as any)
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(data.htmlBody).toContain('<div>hello</div>')
  })

  it('calls LLM and returns modified body', async () => {
    generateContentMock.mockResolvedValueOnce({ text: '<div>modified</div>' })
    process.env.GEMINI_API_KEY = 'test'

    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({ htmlBody: '<div>hello</div>', instruction: 'replace' })
    } as any)
    const res = await POST(req as any)
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(data.htmlBody).toBe('<div>modified</div>')
  })

  it('strips markdown fences from model output', async () => {
    generateContentMock.mockResolvedValueOnce({ text: '```html\n<div>modified</div>\n```' })
    process.env.GEMINI_API_KEY = 'test'

    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({ htmlBody: '<div>hello</div>', instruction: 'replace' })
    } as any)
    const res = await POST(req as any)
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(data.htmlBody).toBe('<div>modified</div>')
  })

  it('strips <pre><code> wrappers from model output', async () => {
    generateContentMock.mockResolvedValueOnce({ text: '<pre><code>\n<div>changed</div>\n</code></pre>' })
    process.env.GEMINI_API_KEY = 'test'

    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({ htmlBody: '<div>hello</div>', instruction: 'replace' })
    } as any)
    const res = await POST(req as any)
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(data.htmlBody).toBe('<div>changed</div>')
  })

  it('falls back to original body when LLM fails', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('bad'))
    process.env.GEMINI_API_KEY = 'test'
    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({ htmlBody: '<div>hello</div>', instruction: 'replace' })
    } as any)
    const res = await POST(req as any)
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(data.htmlBody).toContain('<div>hello</div>')
  })
})


