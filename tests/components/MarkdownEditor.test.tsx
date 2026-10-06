import React, { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react';
import toast from 'react-hot-toast';
import MarkdownEditor from '@/app/components/MarkdownEditor';
import { ThemeProvider } from '@/app/contexts/ThemeContext';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { loading: jest.fn(), dismiss: jest.fn(), error: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

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
  fireEvent.click(
    within(screen.getByTestId('second')).getByTitle('Bold (Ctrl+B)')
  );
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

it('inserts a dropped image at position zero and escapes its filename', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ url: 'https://images.example.com/image.png' }),
  });
  render(<Editors />);
  const editor = screen.getByRole('textbox', {
    name: 'First',
  }) as HTMLTextAreaElement;
  editor.setSelectionRange(0, 0);
  fireEvent.drop(editor, {
    dataTransfer: {
      files: [new File(['image'], '[photo].png', { type: 'image/png' })],
    },
  });
  await waitFor(() =>
    expect(editor).toHaveValue(
      '![_photo_.png](<https://images.example.com/image.png>)First text'
    )
  );
  expect(screen.getByRole('textbox', { name: 'Second' })).toHaveValue(
    'Second text'
  );
});

it('keeps a completed upload when the user switches to preview', async () => {
  let complete!: (value: unknown) => void;
  (fetch as jest.Mock).mockReturnValue(
    new Promise(resolve => {
      complete = resolve;
    })
  );
  render(<Editors />);
  const editor = screen.getByRole('textbox', { name: 'First' });
  fireEvent.paste(editor, {
    clipboardData: {
      items: [
        {
          type: 'image/png',
          getAsFile: () =>
            new File(['image'], 'paste.png', { type: 'image/png' }),
        },
      ],
    },
  });
  fireEvent.click(
    within(screen.getByTestId('first')).getByRole('button', { name: 'preview' })
  );
  complete({
    ok: true,
    json: async () => ({ url: 'https://images.example.com/paste.png' }),
  });
  await waitFor(() =>
    expect(
      within(screen.getByTestId('first')).getByText(
        'First text![paste.png](<https://images.example.com/paste.png>)'
      )
    ).toBeInTheDocument()
  );
  expect(toast.error).not.toHaveBeenCalled();
});

it('does not insert a broken link when the upload response has no URL', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  render(<Editors />);
  const input = within(screen.getByTestId('first'))
    .getByTitle('Upload Image')
    .querySelector('input')!;
  fireEvent.change(input, {
    target: {
      files: [new File(['image'], 'photo.png', { type: 'image/png' })],
    },
  });
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'The image upload did not return a valid URL.'
    )
  );
  expect(screen.getByRole('textbox', { name: 'First' })).toHaveValue(
    'First text'
  );
});
