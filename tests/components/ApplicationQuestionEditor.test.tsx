import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationQuestionEditor } from '../../src/app/components/ApplicationQuestionEditor';
import { ApplicationFieldInput } from '../../src/app/components/ApplicationFieldInput';
import { ApplicationTemplatePreview } from '../../src/app/components/ApplicationTemplatePreview';
import {
  TEMPLATE_FIELD_TYPES,
  applicationAnswerLabel,
} from '../../src/lib/applicationTemplates';
import type { TemplateFieldDefinition } from '../../src/types/event-management';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));
const initial: TemplateFieldDefinition = {
  id: 'interests',
  label: 'Interests',
  type: 'MULTI_SELECT',
  required: false,
};
function Editor() {
  const [field, setField] = useState(initial);
  return (
    <>
      <ApplicationQuestionEditor
        field={field}
        labelPrefix="Question"
        onChange={updates => setField(current => ({ ...current, ...updates }))}
      />
      <output data-testid="field">{JSON.stringify(field)}</output>
      <button onClick={() => setField(initial)}>Reset</button>
    </>
  );
}
it('keeps newlines while typing choices and clears options when the type changes', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.type(
    screen.getByLabelText('Question options'),
    'Design{Enter}Code'
  );
  expect(screen.getByLabelText('Question options')).toHaveValue('Design\nCode');
  expect(JSON.parse(screen.getByTestId('field').textContent!).options).toEqual([
    { label: 'Design', value: 'Design' },
    { label: 'Code', value: 'Code' },
  ]);
  fireEvent.change(screen.getByLabelText('Question type'), {
    target: { value: 'SELECT' },
  });
  expect(screen.getByLabelText('Question options')).toHaveValue('Design\nCode');
  fireEvent.change(screen.getByLabelText('Question type'), {
    target: { value: 'TEXT' },
  });
  expect(
    JSON.parse(screen.getByTestId('field').textContent!).options
  ).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByLabelText('Question options')).toHaveValue('');
});
it('uses the same full field menu for each editor', () => {
  render(<Editor />);
  expect(
    screen
      .getAllByRole('option')
      .map(option => (option as HTMLOptionElement).value)
  ).toEqual(TEMPLATE_FIELD_TYPES);
});
it.each(TEMPLATE_FIELD_TYPES)(
  'renders %s consistently in the live input and preview',
  type => {
    const field = {
      ...initial,
      type,
      options:
        type === 'SELECT' || type === 'MULTI_SELECT'
          ? [{ label: 'Design', value: 'design' }]
          : undefined,
    };
    const { container, unmount } = render(
      <ApplicationFieldInput field={field} onChange={jest.fn()} />
    );
    const live = container.querySelector('input, textarea')!;
    const tag = live.tagName;
    const inputType = live.getAttribute('type');
    unmount();
    const preview = render(<ApplicationTemplatePreview fields={[field]} />);
    const control = preview.container.querySelector('input, textarea')!;
    expect(control.tagName).toBe(tag);
    expect(control.getAttribute('type')).toBe(inputType);
    expect(control).toBeDisabled();
  }
);
it('shows choice labels when stored values differ', () => {
  const field = {
    ...initial,
    options: [
      { label: 'Design', value: 'design' },
      { label: 'Code', value: 'code' },
    ],
  };
  expect(applicationAnswerLabel(field, ['design', 'code'])).toBe(
    'Design, Code'
  );
  expect(applicationAnswerLabel({ ...field, type: 'SELECT' }, 'design')).toBe(
    'Design'
  );
});
