import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApplicationTemplateEditor } from '../../src/app/components/ApplicationTemplateEditor';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

describe('ApplicationTemplateEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'template-1',
        name: 'Chapter questions',
        scope: 'CHAPTER',
        isActive: true,
        fieldsJson: [],
      }),
    }) as jest.Mock;
  });

  it('saves the per-question previous-answer reuse setting', async () => {
    render(
      <ApplicationTemplateEditor
        template={{
          id: 'template-1',
          name: 'Chapter questions',
          scope: 'CHAPTER',
          isActive: true,
          fieldsJson: [
            {
              id: 'project',
              label: 'What do you want to build?',
              type: 'TEXTAREA',
              required: true,
            },
          ],
        }}
      />
    );

    fireEvent.click(
      screen.getByLabelText(/chapter questions field 1 reuse previous answer/i)
    );
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/application-templates/template-1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.any(String),
        })
      );
    });

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body).fieldsJson).toEqual([
      expect.objectContaining({
        id: 'project',
        reusePreviousAnswer: true,
      }),
    ]);
  });

  it('keeps field ids internal while preserving existing ids', async () => {
    render(
      <ApplicationTemplateEditor
        template={{
          id: 'template-1',
          name: 'Chapter questions',
          scope: 'CHAPTER',
          isActive: true,
          fieldsJson: [
            {
              id: 'project',
              label: 'What do you want to build?',
              type: 'TEXTAREA',
              required: true,
            },
          ],
        }}
      />
    );

    expect(
      screen.queryByLabelText(/chapter questions field 1 id/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('project')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save template/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body).fieldsJson[0].id).toBe('project');
  });

  it('generates an internal id when a field is added', async () => {
    render(
      <ApplicationTemplateEditor
        template={{
          id: 'template-1',
          name: 'Chapter questions',
          scope: 'CHAPTER',
          isActive: true,
          fieldsJson: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    fireEvent.change(
      screen.getByLabelText(/chapter questions field 1 label/i),
      { target: { value: 'What do you want to build?' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body).fieldsJson[0].id).toMatch(
      /^question_[0-9a-f-]{36}$/
    );
  });
});
