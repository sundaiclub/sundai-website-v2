import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';
import {
  collectEventLocationQuestions,
  parseEventLocationConfig,
} from '@/lib/eventLocations';

async function questions(eventId: string, fields: unknown) {
  const rows = await prisma.eventRegistration.findMany({
    where: { eventId },
    select: { answersJson: true, templateSnapshotJson: true },
  });
  return collectEventLocationQuestions(fields, rows);
}

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
      questions: await questions(
        params.eventId,
        access.event!.applicationQuestionsJson
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
      if (!config) throw new Error('Select an application question.');
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }
    const candidates = await questions(
      params.eventId,
      access.event!.applicationQuestionsJson
    );
    const question = candidates.find(item => item.id === config.questionId);
    if (
      !question ||
      config.locations.some(location =>
        location.answerValues.some(
          value => !question.options.some(option => option.value === value)
        )
      )
    ) {
      return NextResponse.json(
        { error: 'Select a question and answers from this event.' },
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
