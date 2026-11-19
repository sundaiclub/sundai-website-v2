// Uploads pass through a Vercel function, which rejects request bodies over
// 4.5 MB before our code runs. Keep the limit below that so form fields and
// multipart overhead still fit.
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;

const IMAGE_UPLOAD_SIZE_HINT =
  'Images must be 4 MB or smaller. Try compressing it or saving it as a JPEG or WebP.';

export const IMAGE_UPLOAD_SIZE_ERROR = `This image is too large to upload. ${IMAGE_UPLOAD_SIZE_HINT}`;

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateImageUploadSize(file: Pick<File, 'size'>) {
  return file.size > MAX_IMAGE_UPLOAD_BYTES
    ? `This image is ${formatMegabytes(file.size)}. ${IMAGE_UPLOAD_SIZE_HINT}`
    : null;
}

export async function getImageUploadError(
  response: Response,
  fallback: string
) {
  const payload = await response.json().catch(() => null);
  const message = payload?.message || payload?.error;
  if (response.status === 413) return message || IMAGE_UPLOAD_SIZE_ERROR;
  return message || fallback;
}
