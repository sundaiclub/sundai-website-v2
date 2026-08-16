import {
  IMAGE_UPLOAD_SIZE_ERROR,
  MAX_IMAGE_UPLOAD_BYTES,
  getImageUploadError,
  validateImageUploadSize,
} from '../../src/lib/imageUploads';

describe('image uploads', () => {
  it('rejects files at the 15 MB limit', () => {
    expect(validateImageUploadSize({ size: MAX_IMAGE_UPLOAD_BYTES - 1 })).toBeNull();
    expect(validateImageUploadSize({ size: MAX_IMAGE_UPLOAD_BYTES })).toBe(
      IMAGE_UPLOAD_SIZE_ERROR
    );
  });

  it('turns a 413 response into the file-size message', async () => {
    const response = new Response(null, { status: 413 });

    await expect(
      getImageUploadError(response, 'Unable to upload image.')
    ).resolves.toBe(IMAGE_UPLOAD_SIZE_ERROR);
  });
});
