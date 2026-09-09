import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApplicationChoiceField } from '../../src/app/components/ApplicationChoiceField';
import { ApplicationTemplatePreview } from '../../src/app/components/ApplicationTemplatePreview';
import { validateRequiredApplicationAnswers } from '../../src/lib/applicationTemplates';
import type {
  JsonValue,
  TemplateFieldDefinition,
} from '../../src/types/event-management';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

const field: TemplateFieldDefinition = {
  id: 'interests',
  label: 'Interests',
  type: 'MULTI_SELECT',
  required: true,
  options: [
    { label: 'Design', value: 'design' },
    { label: 'Code', value: 'code' },
  ],
};

function Form({
  type = 'MULTI_SELECT',
  initial,
}: {
  type?: TemplateFieldDefinition['type'];
  initial?: JsonValue;
}) {
  const [value, setValue] = useState<JsonValue | undefined>(initial);
  return (
    <>
      <ApplicationChoiceField
        field={{ ...field, type }}
        value={value}
        onChange={setValue}
      />
      <output data-testid="answer">{JSON.stringify(value)}</output>
    </>
  );
}

it('selects multiple options and removes only the unchecked option', () => {
  render(<Form initial={['design']} />);
  expect(screen.getByLabelText('Design')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Code'));
  expect(screen.getByTestId('answer')).toHaveTextContent('["design","code"]');
  fireEvent.click(screen.getByLabelText('Design'));
  expect(screen.getByTestId('answer')).toHaveTextContent('["code"]');
});

it('replaces the previous single choice and can clear the answer', () => {
  render(<Form type="SELECT" initial="design" />);
  fireEvent.click(screen.getByLabelText('Code'));
  expect(screen.getByLabelText('Design')).not.toBeChecked();
  expect(screen.getByTestId('answer')).toHaveTextContent('"code"');
  fireEvent.click(screen.getByLabelText('Code'));
  expect(screen.getByTestId('answer')).toHaveTextContent('""');
});

it.each(['SELECT', 'MULTI_SELECT'] as const)(
  'previews all %s choices as disabled checkboxes',
  type => {
    render(<ApplicationTemplatePreview fields={[{ ...field, type }]} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByLabelText('Design')).toBeDisabled();
    expect(screen.getByLabelText('Code')).toBeDisabled();
  }
);

it('connects help and validation errors to the choice group', () => {
  render(
    <ApplicationChoiceField field={field} error="Interests is required." />
  );
  expect(
    screen.getByRole('group', { name: 'Interests' })
  ).toHaveAccessibleDescription(
    'Select all that apply. Required. Interests is required.'
  );
  expect(
    validateRequiredApplicationAnswers([field], { interests: [] })
  ).toHaveLength(1);
  expect(
    validateRequiredApplicationAnswers([field], { interests: ['code'] })
  ).toEqual([]);
});
