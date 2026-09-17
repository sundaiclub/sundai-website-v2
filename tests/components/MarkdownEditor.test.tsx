import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MarkdownEditor from '@/app/components/MarkdownEditor';
import { ThemeProvider } from '@/app/contexts/ThemeContext';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

function Editors() {
  const [first, setFirst] = useState('First text');
  const [second, setSecond] = useState('Second text');
  return (
    <ThemeProvider>
      <div data-testid="first">
        <MarkdownEditor label="First" value={first} onChange={setFirst} />
      </div>
      <div data-testid="second">
        <MarkdownEditor label="Second" value={second} onChange={setSecond} />
      </div>
    </ThemeProvider>
  );
}

it('keeps formatting and previews independent when a page has multiple editors', () => {
  render(<Editors />);
  const first = screen.getByRole('textbox', {
    name: 'First',
  }) as HTMLTextAreaElement;
  const second = screen.getByRole('textbox', {
    name: 'Second',
  }) as HTMLTextAreaElement;
  expect(first.id).not.toBe(second.id);
  second.setSelectionRange(0, 6);
  fireEvent.click(within(screen.getByTestId('second')).getByTitle('Bold (Ctrl+B)'));
  expect(second).toHaveValue('**Second** text');
  expect(first).toHaveValue('First text');
  fireEvent.click(
    within(screen.getByTestId('second')).getByRole('button', {
      name: 'preview',
    })
  );
  expect(
    screen.queryByRole('textbox', { name: 'Second' })
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId('second')).getByText('**Second** text')
  ).toBeInTheDocument();
  expect(first).toBeInTheDocument();
});
