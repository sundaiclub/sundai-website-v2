import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttendanceTable from '../../src/app/components/AttendanceTable';

// Mock fetch
global.fetch = jest.fn();

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

// Mock date-fns format function
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM d, yyyy') {
      return 'Jan 1, 2023';
    }
    if (formatStr === 'h:mm a') {
      return '10:00 AM';
    }
    return 'formatted date';
  }),
}));

const mockAttendanceData = [
  {
    id: 'attendance-1',
    date: '2023-01-01',
    checkInTime: '2023-01-01T10:00:00Z',
    checkOutTime: '2023-01-01T18:00:00Z',
    duration: 480, // 8 hours in minutes
    location: 'Office',
    verified: true,
    hacker: {
      name: 'John Doe',
      avatar: { url: 'avatar1.jpg' },
      totalMinutesAttended: 2400, // 40 hours
    },
    verifiedBy: {
      name: 'Admin User',
    },
  },
  {
    id: 'attendance-2',
    date: '2023-01-02',
    checkInTime: '2023-01-02T09:00:00Z',
    checkOutTime: null,
    duration: null,
    location: 'Office',
    verified: false,
    hacker: {
      name: 'Jane Smith',
      avatar: null,
      totalMinutesAttended: 1200, // 20 hours
    },
    verifiedBy: null,
  },
];

describe('AttendanceTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockAttendanceData),
    });
  });

  it('should render loading state initially', () => {
    render(<AttendanceTable />);
    expect(screen.queryByText('Attendance Records')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render attendance records after loading', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('Attendance Records')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('should display hacker information correctly', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check total hours display
    expect(screen.getByText('Total: 40h 0m')).toBeInTheDocument();
    expect(screen.getByText('Total: 20h 0m')).toBeInTheDocument();
  });

  it('should display avatar when available', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      const avatar = screen.getByAltText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'avatar1.jpg');
    });
  });

  it('should display initials when avatar is not available', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('J')).toBeInTheDocument(); // Jane Smith's initial
    });
  });

  it('should display check-in and check-out times', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getAllByText('10:00 AM')).toHaveLength(3); // All check-in times
      expect(screen.getByText('Active')).toBeInTheDocument(); // For Jane who hasn't checked out
    });
  });

  it('should display duration correctly', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('8h 0m')).toBeInTheDocument(); // John's duration
      expect(screen.getByText('-')).toBeInTheDocument(); // Jane's no duration
    });
  });

  it('should display verification status correctly', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      const verifiedBadge = screen.getByText('Verified');
      const pendingBadge = screen.getByText('Pending');
      
      expect(verifiedBadge).toHaveClass('bg-green-100', 'text-green-800');
      expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  it('should allow changing date range', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('Attendance Records')).toBeInTheDocument();
    });

    const startDateInput = screen.getByDisplayValue('2025-08-23'); // 30 days ago
    const endDateInput = screen.getByDisplayValue('2025-09-22'); // Today

    fireEvent.change(startDateInput, { target: { value: '2023-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-01-31' } });

    // Should trigger a new fetch with updated date range
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2023-01-01T00:00:00.000Z')
      );
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching attendance:', expect.any(Error));
    });

    // Should still show the table structure even with no data
    expect(screen.getByText('Attendance Records')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should format dates correctly using date-fns', async () => {
    const { format } = require('date-fns');
    
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check that format was called with correct parameters
    expect(format).toHaveBeenCalledWith(new Date('2023-01-01'), 'MMM d, yyyy');
    expect(format).toHaveBeenCalledWith(new Date('2023-01-01T10:00:00Z'), 'h:mm a');
  });

  it('should display table headers correctly', async () => {
    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('Hacker')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Check In')).toBeInTheDocument();
      expect(screen.getByText('Check Out')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('should handle empty attendance data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue([]),
    });

    render(<AttendanceTable />);
    
    await waitFor(() => {
      expect(screen.getByText('Attendance Records')).toBeInTheDocument();
    });

    // Should show empty table body
    const tableBody = screen.getByRole('table').querySelector('tbody');
    expect(tableBody?.children).toHaveLength(0);
  });
});
