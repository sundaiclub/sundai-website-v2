import { POST } from '../../src/app/api/uploads/image/route';

// Mock auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

// Mock uploadToGCS
jest.mock('../../src/lib/gcp-storage', () => ({
  uploadToGCS: jest.fn(),
}));

describe('/api/uploads/image', () => {
  const mockAuth = jest.fn();
  const mockUploadToGCS = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    require('@clerk/nextjs/server').auth = mockAuth;
    require('../../src/lib/gcp-storage').uploadToGCS = mockUploadToGCS;
  });

  describe('POST', () => {
    it('should upload image successfully', async () => {
      mockAuth.mockReturnValue({ userId: 'test-user-id' });
      mockUploadToGCS.mockResolvedValue({
        url: 'https://storage.googleapis.com/bucket/image.jpg',
        filename: 'image.jpg',
      });

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      // Mock FormData
      const mockFormData = {
        get: jest.fn().mockReturnValue(mockFile),
      };
      
      const request = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        url: 'https://storage.googleapis.com/bucket/image.jpg',
      });
      expect(mockUploadToGCS).toHaveBeenCalledWith(mockFile, 'projects');
    });

    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = {
        formData: jest.fn().mockResolvedValue({ get: jest.fn().mockReturnValue(null) }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('should return 400 when no file is provided', async () => {
      mockAuth.mockReturnValue({ userId: 'test-user-id' });

      const request = {
        formData: jest.fn().mockResolvedValue({ get: jest.fn().mockReturnValue(null) }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'No file provided' });
    });

    it('should handle upload errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockAuth.mockReturnValue({ userId: 'test-user-id' });
      mockUploadToGCS.mockRejectedValue(new Error('Upload failed'));

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      const request = {
        formData: jest.fn().mockResolvedValue({ get: jest.fn().mockReturnValue(mockFile) }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to upload image' });
      expect(consoleSpy).toHaveBeenCalledWith('Error uploading image:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
