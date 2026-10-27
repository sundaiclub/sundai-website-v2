import { NextResponse } from 'next/server';
import { isCheckInToken, renderCheckInQrPng } from '@/lib/eventCheckIn';

// Public so email clients can load the image; the QR only encodes the
// organizer-gated check-in URL for this token.
export async function GET(
  _req: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  if (!isCheckInToken(params.token)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const png = await renderCheckInQrPng(params.token);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[CHECK_IN_QR_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
