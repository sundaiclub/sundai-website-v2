export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import {
  generateBedrockText,
  isBedrockTextConfigured,
  streamBedrockText,
} from '@/lib/bedrockText';

type GenerateRequest = {
  htmlBody: string; // only the <body> innerHTML, no head/styles
  instruction?: string; // optional extra instruction to LLM
};

function extractBody(html: string): string {
  try {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (match) return match[1];
    return html;
  } catch {
    return html;
  }
}

function sanitizeReturn(bodyInnerHtml: string): string {
  // Basic safeguard to ensure we only return body inner HTML
  if (!bodyInnerHtml) return '';
  return bodyInnerHtml
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '');
}

function stripModelOutput(output: string): string {
  if (!output) return '';
  let s = String(output).trim();

  // Strip outer triple-backtick fences, optionally labeled (e.g., ```html)
  const fencedBlock = s.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/i);
  if (fencedBlock) {
    s = fencedBlock[1].trim();
  } else {
    // Best-effort if only leading/ending fences present
    s = s.replace(/^```[a-zA-Z0-9_-]*\s*/i, '').replace(/\s*```$/i, '');
  }

  // Strip <pre><code> ... </code></pre> wrapper if present
  const preCode = s.match(
    /^\s*<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>\s*$/i
  );
  if (preCode) {
    s = preCode[1].trim();
  } else {
    // Or just <code> ... </code>
    const codeOnly = s.match(/^\s*<code[^>]*>([\s\S]*?)<\/code>\s*$/i);
    if (codeOnly) s = codeOnly[1].trim();
  }

  return s.trim();
}

export async function POST(req: Request) {
  try {
    const { htmlBody, instruction }: GenerateRequest = await req.json();

    if (typeof htmlBody !== 'string') {
      return NextResponse.json(
        { error: 'htmlBody is required' },
        { status: 400 }
      );
    }

    const bodyOnly = extractBody(htmlBody);

    const acceptHeader = req.headers.get('accept') || '';
    const wantsStream =
      acceptHeader.includes('text/event-stream') ||
      acceptHeader.includes('text/plain');

    if (!instruction || instruction.trim().length === 0) {
      // No LLM modification requested
      if (wantsStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            try {
              controller.enqueue(encoder.encode(sanitizeReturn(bodyOnly)));
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }
      return NextResponse.json({ htmlBody: sanitizeReturn(bodyOnly) });
    }

    const prompt = `You are given the inner HTML of an email <body>. Modify it according to the user instruction, keeping it as valid inline-styled HTML suitable for email clients. Do not add <html>, <head>, or <body> tags. Keep existing structure where possible and improve content as requested. Return only the modified inner HTML. Try to keep the same outline and style as the original. Please remember that our events are called Hacks, not Hackathons.

Instruction: ${instruction}

Current body inner HTML:
${bodyOnly}`;

    if (!isBedrockTextConfigured()) {
      // If no API key, return original body unchanged
      return NextResponse.json({ htmlBody: sanitizeReturn(bodyOnly) });
    }

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Buffer chunks to sanitize wrappers (```html, <pre>/<code>) correctly
            let buffer = '';
            for await (const text of streamBedrockText(prompt)) {
              buffer += text;
            }

            const stripped = stripModelOutput(buffer);
            const finalBody = stripped
              ? sanitizeReturn(stripped)
              : sanitizeReturn(bodyOnly);
            controller.enqueue(encoder.encode(finalBody));
            controller.close();
          } catch (e: unknown) {
            console.error(
              '[NEWS_GENERATE_STREAM]',
              e instanceof Error ? e.message : e
            );
            try {
              controller.enqueue(encoder.encode(sanitizeReturn(bodyOnly)));
            } finally {
              controller.close();
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Fallback to non-streaming JSON response
    let generated = '';
    try {
      generated = await generateBedrockText(prompt);
    } catch (e: unknown) {
      console.error('[NEWS_GENERATE]', e instanceof Error ? e.message : e);
      return NextResponse.json(
        { htmlBody: sanitizeReturn(bodyOnly), error: `LLM error` },
        { status: 200 }
      );
    }
    const stripped = stripModelOutput(generated);
    const trimmed = stripped.trim();
    const result = trimmed ? sanitizeReturn(trimmed) : sanitizeReturn(bodyOnly);

    return NextResponse.json({ htmlBody: result });
  } catch (error) {
    console.error('[NEWS_GENERATE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
