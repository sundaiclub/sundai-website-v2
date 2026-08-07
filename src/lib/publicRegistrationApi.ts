import { NextResponse } from 'next/server';
import type {
  PublicRegistrationActionResult,
  PublicRegistrationFailureReason,
} from '@/lib/eventRegistrations';

const CONFLICT_REASONS = new Set<PublicRegistrationFailureReason>([
  'DUPLICATE_REGISTRATION',
  'EDIT_NOT_ALLOWED',
  'CANCEL_NOT_ALLOWED',
]);

export function publicRegistrationActionResponse(
  result: PublicRegistrationActionResult,
  options: { successStatus?: number } = {}
) {
  if (result.ok) {
    return NextResponse.json(result.registration, {
      status: options.successStatus ?? 200,
    });
  }

  if (result.reason === 'VALIDATION_FAILED') {
    return NextResponse.json(
      { message: 'Application answers are invalid.', issues: result.issues },
      { status: 400 }
    );
  }

  if (
    result.reason === 'EVENT_NOT_FOUND' ||
    result.reason === 'REGISTRATION_NOT_FOUND'
  ) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (result.reason === 'APPLICATIONS_CLOSED') {
    return NextResponse.json(
      { message: 'Applications are closed for this event.' },
      { status: 409 }
    );
  }

  if (CONFLICT_REASONS.has(result.reason) && result.registration) {
    return NextResponse.json(result.registration, { status: 409 });
  }

  return NextResponse.json({ message: result.reason }, { status: 400 });
}
