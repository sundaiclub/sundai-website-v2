import {
  IMAGE_UPLOAD_SIZE_ERROR,
  MAX_IMAGE_UPLOAD_BYTES,
  getImageUploadError,
  uploadImageFile,
  validateImageUploadSize,
} from '../../src/lib/imageUploads';

const SIZE_HINT =
  'Images must be 15 MB or smaller. Try compressing it or saving it as a JPEG or WebP.';

function fakeResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('image uploads', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('allows files up to the 15 MB limit', () => {
    expect(validateImageUploadSize({ size: MAX_IMAGE_UPLOAD_BYTES })).toBeNull();
  });

  it('names the file size when a file is over the limit', () => {
    expect(validateImageUploadSize({ size: 18.25 * 1024 * 1024 })).toBe(
      `This image is 18.3 MB. ${SIZE_HINT}`
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
      JSON.stringify({ error: `This image is 16.0 MB. ${SIZE_HINT}` }),
      { status: 413 }
    );

    await expect(
      getImageUploadError(response, 'Unable to upload image.')
    ).resolves.toBe(`This image is 16.0 MB. ${SIZE_HINT}`);
  });

  it('posts the signed fields and then the file directly to S3', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fakeResponse(
          {
            url: 'https://bucket.s3.amazonaws.com/',
            fields: { key: 'avatars/key.png', Policy: 'policy' },
            uploadToken: 'upload-token',
          },
          201
        )
      )
      .mockResolvedValueOnce(fakeResponse('', 204));
    global.fetch = fetchMock;
    const file = new File(['image'], 'me.png', { type: 'image/png' });

    await expect(uploadImageFile(file, 'avatars')).resolves.toBe('upload-token');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/uploads/image-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'avatars',
        filename: 'me.png',
        contentType: 'image/png',
        size: file.size,
      }),
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://bucket.s3.amazonaws.com/');
    expect([...(init.body as FormData).keys()]).toEqual([
      'key',
      'Policy',
      'file',
    ]);
  });

  it('checks the size before asking for an upload', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const file = new File(['image'], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 16 * 1024 * 1024 });

    await expect(uploadImageFile(file, 'projects')).rejects.toThrow(
      `This image is 16.0 MB. ${SIZE_HINT}`
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the size message when S3 rejects the file as too large', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({ url: 'https://s3/', fields: {}, uploadToken: 't' }, 201)
      )
      .mockResolvedValueOnce(
        fakeResponse('<Error><Code>EntityTooLarge</Code></Error>', 400)
      );
    const file = new File(['image'], 'big.png', { type: 'image/png' });

    await expect(uploadImageFile(file, 'projects')).rejects.toThrow(
      IMAGE_UPLOAD_SIZE_ERROR
    );
  });
});
