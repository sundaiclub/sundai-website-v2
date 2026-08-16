export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;
export const IMAGE_UPLOAD_SIZE_ERROR =
  'File too large. Image files must be smaller than 15 MB.';

export function validateImageUploadSize(file: Pick<File, 'size'>) {
  return file.size >= MAX_IMAGE_UPLOAD_BYTES
    ? IMAGE_UPLOAD_SIZE_ERROR
    : null;
}

export async function getImageUploadError(
  response: Response,
  fallback: string
) {
  if (response.status === 413) return IMAGE_UPLOAD_SIZE_ERROR;

  const payload = await response.json().catch(() => null);
  return payload?.message || payload?.error || fallback;
}
