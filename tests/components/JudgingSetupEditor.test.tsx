import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JudgingSetupEditor from '@/app/organizer/events/[eventId]/judging/JudgingSetupEditor';
import type { EventJudgingConfig } from '@/types/judging';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const config: EventJudgingConfig = {
  judgingEnabled: false,
  projectsHidden: false,
  judgingOpen: false,
  judgesPerProject: 3,
  judgingAssignmentsPublishedAt: null,
  judgingSubmissionsOpenAt: null,
  judgingSubmissionsCloseAt: null,
  eventStartTime: '2026-10-22T14:00:00.000Z',
  eventEndTime: '2026-10-22T22:00:00.000Z',
  timezone: 'America/New_York',
  tracks: [],
  criteria: [],
  judges: [],
};

it('selects project hiding when judging is enabled, and saves an explicit public choice', async () => {
  const onSaved = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ...config, judgingEnabled: true }),
  });
  render(
    <JudgingSetupEditor eventId="event-1" config={config} onSaved={onSaved} />
  );

  const hide = screen.getByRole('checkbox', { name: /Hide event projects/ });
  expect(hide).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: /^Enable judging/ }));
  expect(hide).toBeChecked();
  fireEvent.click(hide);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Save judging setup' })[0]
  );

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const request = (global.fetch as jest.Mock).mock.calls[0][1];
  expect(JSON.parse(request.body)).toMatchObject({
    judgingEnabled: true,
    projectsHidden: false,
    judgesPerProject: 3,
  });
  expect(hide).not.toBeChecked();
});

it('locks allocation settings after publication but allows scoring to close', () => {
  render(
    <JudgingSetupEditor
      eventId="event-1"
      config={{
        ...config,
        judgingEnabled: true,
        judgingOpen: true,
        judgingAssignmentsPublishedAt: '2026-10-22T12:00:00Z',
      }}
      onSaved={jest.fn()}
    />
  );
  expect(
    screen.getByRole('spinbutton', { name: /Judges per project/ })
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add track' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Open scoring/ })).toBeEnabled();
});

it('keeps projects hidden when scoring or judging is disabled until the visibility toggle is cleared', () => {
  render(
    <JudgingSetupEditor
      eventId="event-1"
      config={{ ...config, judgingEnabled: true, projectsHidden: true }}
      onSaved={jest.fn()}
    />
  );
  fireEvent.click(screen.getByRole('checkbox', { name: /Open scoring/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /^Enable judging/ }));
  const hide = screen.getByRole('checkbox', { name: /Hide event projects/ });
  expect(hide).toBeChecked();
  expect(hide).toBeEnabled();
});
