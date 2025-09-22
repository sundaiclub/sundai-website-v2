import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttendancePage from '../../src/app/attendance/page';
import { useUserContext } from '../../src/app/contexts/UserContext';
import { useTheme } from '../../src/app/contexts/ThemeContext';

// Mock the contexts
jest.mock('../../src/app/contexts/UserContext');
jest.mock('../../src/app/contexts/ThemeContext');

// Mock Next.js components
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

jest.mock('next/link', () => {
  return function MockLink({ href, children }: any) {
    return <a href={href}>{children}</a>;
  };
});

// Mock fetch
global.fetch = jest.fn();

const mockUseUserContext = useUserContext as jest.Mock;
const mockUseTheme = useTheme as jest.Mock;

describe('AttendancePage', () => {
  const mockUserInfo = {
    id: 'user-1',
    name: 'John Doe',
    role: 'USER',
  };

  const mockWeekData = {
    id: 'week-1',
    number: 1,
    startDate: '2023-01-01',
    endDate: '2023-01-07',
    theme: 'Test Theme',
    attendance: [
      {
        id: 'attendance-1',
        status: 'PRESENT',
        timestamp: '2023-01-01T10:00:00Z',
        hacker: {
          id: 'hacker-1',
          name: 'John Doe',
          avatar: { url: 'avatar1.jpg' },
        },
      },
      {
        id: 'attendance-2',
        status: 'LATE',
        timestamp: '2023-01-01T10:30:00Z',
        hacker: {
          id: 'hacker-2',
          name: 'Jane Smith',
          avatar: null,
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      userInfo: mockUserInfo,
    });
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockWeekData),
    });
  });

  it('should render loading state initially', () => {
    render(<AttendancePage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render attendance page with week data', async () => {
    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Week 1 Attendance')).toBeInTheDocument();
    });

    expect(screen.getByText('Check In')).toBeInTheDocument();
    expect(screen.getByText('Attendance List')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should show check-in button when user is not checked in', async () => {
    // Mock user not in attendance list
    const weekDataWithoutUser = {
      ...mockWeekData,
      attendance: [
        {
          id: 'attendance-2',
          status: 'LATE',
          timestamp: '2023-01-01T10:30:00Z',
          hacker: {
            id: 'hacker-2',
            name: 'Jane Smith',
            avatar: null,
          },
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(weekDataWithoutUser),
    });

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Check In for Week 1')).toBeInTheDocument();
    });
  });

  it('should show checked-in status when user is already checked in', async () => {
    // Mock user as already checked in
    mockUseUserContext.mockReturnValue({
      userInfo: { id: 'hacker-1', name: 'John Doe' },
      isAdmin: false,
    });

    // Mock attendance data with user already checked in
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'week-1',
          number: 1,
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          attendance: [
            {
              id: 'attendance-1',
              hacker: { id: 'hacker-1', name: 'John Doe', avatar: { url: 'avatar1.jpg' } },
              status: 'PRESENT',
              timestamp: '2024-01-01T10:00:00Z',
            },
          ],
        }),
    });

    render(<AttendancePage />);

    await waitFor(() => {
      // The component shows a "checked in" message when user is already checked in
      expect(screen.getByText("You're checked in for this week!")).toBeInTheDocument();
    });
  });

  it('should handle check-in successfully', async () => {
    // Mock user not in attendance list initially
    const weekDataWithoutUser = {
      ...mockWeekData,
      attendance: [],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(weekDataWithoutUser),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWeekData),
      });

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Check In for Week 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Check In for Week 1'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  it('should handle check-in error', async () => {
    // Mock user not in attendance list initially
    const weekDataWithoutUser = {
      ...mockWeekData,
      attendance: [],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(weekDataWithoutUser),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ message: 'Check-in failed' }),
      });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Check In for Week 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Check In for Week 1'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Check-in failed');
    });

    alertSpy.mockRestore();
  });

  it('should display attendance status correctly', async () => {
    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('PRESENT')).toBeInTheDocument();
      expect(screen.getByText('LATE')).toBeInTheDocument();
    });
  });

  it('should display hacker avatars when available', async () => {
    render(<AttendancePage />);

    await waitFor(() => {
      const avatar = screen.getByAltText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'avatar1.jpg');
    });
  });

  it('should display initials when avatar is not available', async () => {
    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('J')).toBeInTheDocument(); // Jane Smith's initial
    });
  });

  it('should display timestamps correctly', async () => {
    render(<AttendancePage />);

    await waitFor(() => {
      // Check that timestamps are displayed (format may vary based on locale)
      // The actual timestamps are "5:00:00 AM" and "5:30:00 AM"
      expect(screen.getByText(/5:00:00 AM/)).toBeInTheDocument();
    });
  });

  it('should show no attendance message when no records', async () => {
    const emptyWeekData = {
      ...mockWeekData,
      attendance: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(emptyWeekData),
    });

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('No attendance records yet')).toBeInTheDocument();
    });
  });

  it('should handle fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<AttendancePage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching current week:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should render in dark mode', async () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: true,
    });

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Week 1 Attendance')).toBeInTheDocument();
    });

    // Check for dark mode classes
    const checkInSection = screen.getByText('Check In').closest('div');
    expect(checkInSection).toHaveClass('bg-gray-800');
  });

  it('should handle missing user info', async () => {
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      userInfo: null,
    });

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Check In for Week 1')).toBeInTheDocument();
    });
  });
});
