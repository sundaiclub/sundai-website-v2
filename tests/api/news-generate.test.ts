jest.mock('../../src/lib/bedrockText', () => ({
  generateBedrockText: jest.fn(),
  isBedrockTextConfigured: jest.fn(),
  streamBedrockText: jest.fn(),
}));

import {
  generateBedrockText,
  isBedrockTextConfigured,
} from '../../src/lib/bedrockText';
import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/news/generate/route';

const generateBedrockTextMock = generateBedrockText as jest.MockedFunction<
  typeof generateBedrockText
>;
const isBedrockTextConfiguredMock =
  isBedrockTextConfigured as jest.MockedFunction<
    typeof isBedrockTextConfigured
  >;

describe('/api/news/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isBedrockTextConfiguredMock.mockReturnValue(true);
  });

  it('returns original body when no instruction provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({ htmlBody: '<div>hello</div>' }),
    } as any);
    const res = await POST(req as any);
    const data = await (res as any).json();
    expect(res.status).toBe(200);
    expect(data.htmlBody).toContain('<div>hello</div>');
  });

  it('calls LLM and returns modified body', async () => {
    generateBedrockTextMock.mockResolvedValueOnce('<div>modified</div>');

    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({
        htmlBody: '<div>hello</div>',
        instruction: 'replace',
      }),
    } as any);
    const res = await POST(req as any);
    const data = await (res as any).json();
    expect(res.status).toBe(200);
    expect(data.htmlBody).toBe('<div>modified</div>');
  });

  it('strips markdown fences from model output', async () => {
    generateBedrockTextMock.mockResolvedValueOnce(
      '```html\n<div>modified</div>\n```'
    );

    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({
        htmlBody: '<div>hello</div>',
        instruction: 'replace',
      }),
    } as any);
    const res = await POST(req as any);
    const data = await (res as any).json();
    expect(res.status).toBe(200);
    expect(data.htmlBody).toBe('<div>modified</div>');
  });

  it('strips <pre><code> wrappers from model output', async () => {
    generateBedrockTextMock.mockResolvedValueOnce(
      '<pre><code>\n<div>changed</div>\n</code></pre>'
    );

    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({
        htmlBody: '<div>hello</div>',
        instruction: 'replace',
      }),
    } as any);
    const res = await POST(req as any);
    const data = await (res as any).json();
    expect(res.status).toBe(200);
    expect(data.htmlBody).toBe('<div>changed</div>');
  });

  it('falls back to original body when LLM fails', async () => {
    generateBedrockTextMock.mockRejectedValueOnce(new Error('bad'));
    const req = new NextRequest('http://localhost:3000/api/news/generate', {
      method: 'POST',
      body: JSON.stringify({
        htmlBody: '<div>hello</div>',
        instruction: 'replace',
      }),
    } as any);
    const res = await POST(req as any);
    const data = await (res as any).json();
    expect(res.status).toBe(200);
    expect(data.htmlBody).toContain('<div>hello</div>');
  });
});
