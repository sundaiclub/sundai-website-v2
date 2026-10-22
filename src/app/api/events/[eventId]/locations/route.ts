import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';
import { parseEventLocationConfig } from '@/lib/eventLocations';

export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;
    return NextResponse.json({
      config: parseEventLocationConfig(
        access.event!.communicationLocationsJson
      ),
    });
  } catch (error) {
    console.error('[EVENT_LOCATIONS_GET]', error);
    return NextResponse.json(
      { error: 'Unable to load event locations.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;
    let config;
    try {
      config = parseEventLocationConfig(await request.json());
      if (!config) throw new Error('Enter a list of event locations.');
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }
    await prisma.event.update({
      where: { id: params.eventId },
      data: { communicationLocationsJson: config },
    });
    return NextResponse.json({ config });
  } catch (error) {
    console.error('[EVENT_LOCATIONS_PATCH]', error);
    return NextResponse.json(
      { error: 'Unable to save event locations.' },
      { status: 500 }
    );
  }
}
