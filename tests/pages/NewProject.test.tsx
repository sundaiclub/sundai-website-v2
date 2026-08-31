import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import NewProject from '../../src/app/projects/new/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';
import * as api from '../../src/lib/api';
import toast from 'react-hot-toast';

jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('../../src/lib/api', () => ({
  createProject: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<
  typeof useSearchParams
>;
const mockCreateProject = api.createProject as jest.MockedFunction<
  typeof api.createProject
>;
const mockToast = toast as jest.Mocked<typeof toast>;

const defaultProps = {
  user: {
    id: 'current-user-id',
    primaryEmailAddress: {
      emailAddress: 'test@example.com',
    },
  },
  isLoaded: true,
};

const defaultRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('NewProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue(defaultProps);
    mockUseRouter.mockReturnValue(defaultRouter);
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);
    mockCreateProject.mockResolvedValue({
      id: 'new-project-id',
      title: 'New Project',
    });

    global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      if (input === '/api/hackers') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'hacker-1', name: 'John Doe', email: 'john@example.com' },
              { id: 'hacker-2', name: 'Jane Smith', email: 'jane@example.com' },
            ]),
        });
      }
      if (input === '/api/events/project-options') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'new-project-id' }),
      });
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
  });

  it('should render new project form', () => {
    renderWithTheme(<NewProject />);

    expect(screen.getByText('Initialize New Project')).toBeInTheDocument();
    expect(screen.getByText('Launch Lead *')).toBeInTheDocument();
    expect(screen.getByText('Project Title *')).toBeInTheDocument();
    expect(screen.getByText('Brief Description *')).toBeInTheDocument();
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
  });

  it('should render all form fields', () => {
    renderWithTheme(<NewProject />);

    expect(screen.getByLabelText('Project Title *')).toBeInTheDocument();
    expect(screen.getByLabelText('Brief Description *')).toBeInTheDocument();
    expect(screen.getByText('+ Add Team Members')).toBeInTheDocument();
  });

  it('should render team management section', () => {
    renderWithTheme(<NewProject />);

    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('+ Add Team Members')).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    renderWithTheme(<NewProject />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hackers');
    });

    fireEvent.change(screen.getByLabelText('Project Title *'), {
      target: { value: 'New Project' },
    });
    fireEvent.change(screen.getByLabelText('Brief Description *'), {
      target: { value: 'New project description' },
    });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Please select a launch lead'
      );
    });
  });

  it('should handle form validation', async () => {
    renderWithTheme(<NewProject />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hackers');
    });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Please select a launch lead'
      );
    });
  });

  it('should handle unauthenticated user', () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    renderWithTheme(<NewProject />);

    expect(screen.getByText('Initialize New Project')).toBeInTheDocument();
  });

  it('should update form state when inputs change', () => {
    renderWithTheme(<NewProject />);

    const titleInput = screen.getByLabelText('Project Title *');
    const descriptionInput = screen.getByLabelText('Brief Description *');

    fireEvent.change(titleInput, { target: { value: 'Test Project' } });
    fireEvent.change(descriptionInput, {
      target: { value: 'Test Description' },
    });

    expect(titleInput).toHaveValue('Test Project');
    expect(descriptionInput).toHaveValue('Test Description');
  });

  it('selects the source event and carries it to the detailed editor', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({
        sourceEventId: 'event-1',
        returnTo: '/pitch/event-1',
      }) as any
    );
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL) => {
        if (input === '/api/hackers') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: 'hacker-1', name: 'John Doe', email: 'test@example.com' },
            ],
          });
        }
        if (input === '/api/events/project-options') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'event-1',
                title: 'Boston Build Night',
                chapterName: 'Sundai Boston',
                image: null,
                selectedByDefault: false,
              },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'new-project-id' }),
        });
      }
    );

    renderWithTheme(<NewProject />);
    const eventChoice = await screen.findByRole('checkbox', {
      name: /boston build night/i,
    });
    expect(eventChoice).toBeChecked();
    expect(
      screen.getByRole('img', { name: 'Boston Build Night event' })
    ).toHaveAttribute('src', expect.stringContaining('sundai_logo'));

    fireEvent.change(screen.getByLabelText('Project Title *'), {
      target: { value: 'New Project' },
    });
    fireEvent.change(screen.getByLabelText('Brief Description *'), {
      target: { value: 'New project description' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() =>
      expect(defaultRouter.push).toHaveBeenCalledWith(
        expect.stringContaining(
          '/projects/new-project-id/edit?eventId=event-1&sourceEventId=event-1'
        )
      )
    );
  });

  it('constrains long event names to the event card', async () => {
    const longTitle =
      'A very long current event title that must stay inside its project form card';
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL) => {
        if (input === '/api/events/project-options') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'event-long-title',
                title: longTitle,
                chapterName: 'Sundai Boston',
                image: null,
                selectedByDefault: false,
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }
    );

    renderWithTheme(<NewProject />);

    const title = await screen.findByText(longTitle);
    expect(title).toHaveClass('truncate');
    expect(title.parentElement).toHaveClass('min-w-0', 'flex-1');
    expect(title.closest('label')).toHaveClass('max-w-full', 'overflow-hidden');
    expect(title.closest('fieldset')).toHaveClass('min-w-0');
  });
});
