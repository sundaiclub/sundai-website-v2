import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProjectDetail from '../../src/app/projects/[projectId]/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

const mockNextImage = jest.fn((props: any) => <img {...props} />);

// Mock next/image to use plain img for reliable onError handling
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => mockNextImage(props),
}));

const mockUseUserContext = jest.fn();

// Mock UserContext
jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

// Mock next/navigation
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  back: jest.fn(),
  replace: jest.fn(),
};
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({
    projectId: 'test-project-id',
  }),
  useSearchParams: () => ({
    get: () => null,
    entries: () => new Map().entries(),
  }),
}));

// Silence toast imports used in page
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProjectDetail Page - Like Count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserContext.mockReturnValue({ userInfo: null, loading: false });
    global.fetch = jest.fn();
  });

  it('displays like count from API response', async () => {
    const mockProject = {
      id: 'test-project-id',
      title: 'Test Project',
      preview: 'Preview text',
      description: 'Long description',
      status: 'APPROVED',
      is_starred: false,
      is_broken: false,
      thumbnail: { url: 'https://example.com/thumbnail.jpg' },
      launchLead: { id: 'lead-1', name: 'Lead User', avatar: null },
      participants: [],
      techTags: [],
      domainTags: [],
      startDate: new Date('2024-01-01').toISOString(),
      likes: [
        { hackerId: 'a', createdAt: new Date().toISOString() },
        { hackerId: 'b', createdAt: new Date().toISOString() },
        { hackerId: 'c', createdAt: new Date().toISOString() },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <ProjectDetail />
      </ThemeProvider>
    );

    await waitFor(() => {
      // The like button shows the count as text
      expect(screen.getByLabelText('Likes 3')).toBeInTheDocument();
    });
  });

  it('falls back to default avatar in team when image fails', async () => {
    const mockProject = {
      id: 'test-project-id',
      title: 'Test Project',
      preview: 'Preview text',
      description: 'Long description',
      status: 'APPROVED',
      is_starred: false,
      is_broken: false,
      thumbnail: { url: 'https://example.com/thumbnail.jpg' },
      launchLead: {
        id: 'lead-1',
        name: 'Lead User',
        avatar: { url: 'https://bad.example.com/lead.jpg' },
      },
      participants: [
        {
          role: 'hacker',
          hacker: {
            id: 'h1',
            name: 'Alice',
            avatar: { url: 'https://bad.example.com/a.jpg' },
          },
        },
      ],
      techTags: [],
      domainTags: [],
      startDate: new Date('2024-01-01').toISOString(),
      likes: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <ProjectDetail />
      </ThemeProvider>
    );

    // Wait for page to load title
    await waitFor(() =>
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    );

    // Find launch lead img by alt
    const leadImg = screen.getByAltText('Lead User') as HTMLImageElement;
    fireEvent.error(leadImg);
    expect(leadImg.src).toContain('/images/default_avatar.png');

    // Participant avatar fallback
    const participantImg = screen.getByAltText('Alice') as HTMLImageElement;
    fireEvent.error(participantImg);
    expect(participantImg.src).toContain('/images/default_avatar.png');
  });

  it('keeps avatar elements mounted when the like state changes', async () => {
    mockUseUserContext.mockReturnValue({
      userInfo: { id: 'viewer-1', role: 'HACKER' },
      loading: false,
    });
    const mockProject = {
      id: 'test-project-id',
      title: 'Stable Avatar Project',
      preview: 'Preview text',
      description: 'Long description',
      status: 'APPROVED',
      thumbnail: { url: 'https://example.com/thumbnail.jpg' },
      launchLead: {
        id: 'lead-1',
        name: 'Lead User',
        avatar: { url: 'https://example.com/lead.jpg' },
      },
      participants: [
        {
          role: 'hacker',
          hacker: {
            id: 'h1',
            name: 'Alice',
            avatar: { url: 'https://example.com/alice.jpg' },
          },
        },
      ],
      techTags: [],
      domainTags: [],
      startDate: new Date('2024-01-01').toISOString(),
      likes: [],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      })
      .mockResolvedValueOnce({ ok: true });

    render(
      <ThemeProvider>
        <ProjectDetail />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('Stable Avatar Project')).toBeInTheDocument()
    );
    const leadAvatar = screen.getByAltText('Lead User');
    const memberAvatar = screen.getByAltText('Alice');
    const avatarRenderCounts = {
      lead: mockNextImage.mock.calls.filter(
        ([props]) => props.alt === 'Lead User'
      ).length,
      member: mockNextImage.mock.calls.filter(
        ([props]) => props.alt === 'Alice'
      ).length,
    };

    fireEvent.click(screen.getByLabelText('Likes 0'));

    await waitFor(() =>
      expect(screen.getByLabelText('Likes 1')).toBeInTheDocument()
    );
    expect(screen.getByAltText('Lead User')).toBe(leadAvatar);
    expect(screen.getByAltText('Alice')).toBe(memberAvatar);
    expect(
      mockNextImage.mock.calls.filter(([props]) => props.alt === 'Lead User')
    ).toHaveLength(avatarRenderCounts.lead);
    expect(
      mockNextImage.mock.calls.filter(([props]) => props.alt === 'Alice')
    ).toHaveLength(avatarRenderCounts.member);
  });
});
