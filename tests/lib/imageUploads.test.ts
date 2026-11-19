import {
  IMAGE_UPLOAD_SIZE_ERROR,
  MAX_IMAGE_UPLOAD_BYTES,
  getImageUploadError,
  validateImageUploadSize,
} from '../../src/lib/imageUploads';

describe('image uploads', () => {
  it('allows files up to the 4 MB limit', () => {
    expect(validateImageUploadSize({ size: MAX_IMAGE_UPLOAD_BYTES })).toBeNull();
  });

  it('names the file size when a file is over the limit', () => {
    expect(validateImageUploadSize({ size: 8.25 * 1024 * 1024 })).toBe(
      'This image is 8.3 MB. Images must be 4 MB or smaller. Try compressing it or saving it as a JPEG or WebP.'
    );
  });

  it('turns a 413 response without a JSON body into the size message', async () => {
    const response = new Response('Request Entity Too Large', { status: 413 });

    await expect(
      getImageUploadError(response, 'Unable to upload image.')
    ).resolves.toBe(IMAGE_UPLOAD_SIZE_ERROR);
  });

  it('keeps the server message from a 413 response', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'This image is 5.0 MB. Images must be 4 MB or smaller.',
      }),
      { status: 413 }
    );

    await expect(
      getImageUploadError(response, 'Unable to upload image.')
    ).resolves.toBe('This image is 5.0 MB. Images must be 4 MB or smaller.');
  });
});
