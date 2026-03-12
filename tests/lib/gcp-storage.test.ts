import { uploadToGCS, deleteFromGCS } from '../../src/lib/gcp-storage';

const mockSave = jest.fn();
const mockDelete = jest.fn();
const mockFileRef = jest.fn(() => ({
  save: mockSave,
  delete: mockDelete,
}));
const mockBucketRef = jest.fn(() => ({
  name: 'test-bucket',
  file: mockFileRef,
}));
const mockStorageCtor = jest.fn(() => ({
  bucket: mockBucketRef,
}));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation((...args: unknown[]) => mockStorageCtor(...args)),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

const originalEnv = process.env;

const makeFile = (name = 'test.txt', type = 'text/plain'): File =>
  ({
    name,
    type,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(12)),
  }) as unknown as File;

describe('GCP Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_PRIVATE_KEY: Buffer.from(
        JSON.stringify({
          client_email: 'test@test.iam.gserviceaccount.com',
          private_key: 'test-private-key',
        })
      ).toString('base64'),
      GOOGLE_CLOUD_BUCKET: 'test-bucket',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('uploadToGCS', () => {
    it('uploads file successfully with default folder', async () => {
      mockSave.mockResolvedValue(undefined);

      const result = await uploadToGCS(makeFile());

      expect(result).toEqual({
        url: 'https://storage.googleapis.com/test-bucket/projects/mock-uuid-123-test.txt',
        filename: 'projects/mock-uuid-123-test.txt',
      });
      expect(mockBucketRef).toHaveBeenCalledWith('test-bucket');
      expect(mockFileRef).toHaveBeenCalledWith('projects/mock-uuid-123-test.txt');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('uploads file successfully with custom folder', async () => {
      mockSave.mockResolvedValue(undefined);

      const result = await uploadToGCS(makeFile(), 'custom-folder');

      expect(result).toEqual({
        url: 'https://storage.googleapis.com/test-bucket/custom-folder/mock-uuid-123-test.txt',
        filename: 'custom-folder/mock-uuid-123-test.txt',
      });
    });

    it('sanitizes filename correctly', async () => {
      mockSave.mockResolvedValue(undefined);

      const result = await uploadToGCS(makeFile('test file with spaces & special chars!.txt'));

      expect(result.filename).toBe('projects/mock-uuid-123-test_file_with_spaces___special_chars_.txt');
    });

    it('propagates upload errors', async () => {
      mockSave.mockRejectedValue(new Error('Upload failed'));

      await expect(uploadToGCS(makeFile())).rejects.toThrow('Upload failed');
    });

    it('throws when GOOGLE_PRIVATE_KEY is missing', async () => {
      delete process.env.GOOGLE_PRIVATE_KEY;

      await expect(uploadToGCS(makeFile())).rejects.toThrow('Missing GOOGLE_PRIVATE_KEY');
    });

    it('throws when GOOGLE_CLOUD_BUCKET is missing', async () => {
      delete process.env.GOOGLE_CLOUD_BUCKET;

      await expect(uploadToGCS(makeFile())).rejects.toThrow('Missing GOOGLE_CLOUD_BUCKET');
    });

    it('throws when GOOGLE_PRIVATE_KEY is invalid', async () => {
      process.env.GOOGLE_PRIVATE_KEY = 'not-base64-json';

      await expect(uploadToGCS(makeFile())).rejects.toThrow('Invalid GOOGLE_PRIVATE_KEY');
    });
  });

  describe('deleteFromGCS', () => {
    it('deletes file successfully', async () => {
      mockDelete.mockResolvedValue(undefined);

      await deleteFromGCS('test-filename.jpg');

      expect(mockFileRef).toHaveBeenCalledWith('test-filename.jpg');
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('propagates delete errors', async () => {
      mockDelete.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteFromGCS('test-filename.jpg')).rejects.toThrow('Delete failed');
    });
  });
});
