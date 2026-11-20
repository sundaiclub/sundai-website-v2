// Browsers upload images straight to S3 with a signed POST policy, so the
// file never passes through a Vercel function and its 4.5 MB body limit.
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

export const IMAGE_UPLOAD_FOLDERS = [
  'projects',
  'chapters',
  'events',
  'avatars',
] as const;
export type ImageUploadFolder = (typeof IMAGE_UPLOAD_FOLDERS)[number];

export function isImageUploadFolder(value: unknown): value is ImageUploadFolder {
  return (
    typeof value === 'string' &&
    (IMAGE_UPLOAD_FOLDERS as readonly string[]).includes(value)
  );
}

// An upload problem the user can fix, with the HTTP status to report it as.
export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413
  ) {
    super(message);
  }
}

export type ImageUploadIntent = {
  url: string;
  fields: Record<string, string>;
  uploadToken: string;
};

const IMAGE_UPLOAD_SIZE_HINT =
  'Images must be 15 MB or smaller. Try compressing it or saving it as a JPEG or WebP.';

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

// Uploads an image to S3 and returns the token that an image route uses to
// attach the uploaded file to a record.
export async function uploadImageFile(
  file: File,
  folder: ImageUploadFolder
): Promise<string> {
  const sizeError = validateImageUploadSize(file);
  if (sizeError) throw new Error(sizeError);

  const intentResponse = await fetch('/api/uploads/image-intents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  if (!intentResponse.ok) {
    throw new Error(
      await getImageUploadError(intentResponse, 'Unable to upload the image.')
    );
  }
  const intent = (await intentResponse.json()) as ImageUploadIntent;

  const formData = new FormData();
  Object.entries(intent.fields).forEach(([name, value]) =>
    formData.append(name, value)
  );
  formData.append('file', file);
  const uploadResponse = await fetch(intent.url, {
    method: 'POST',
    body: formData,
  });
  if (!uploadResponse.ok) {
    const body = await uploadResponse.text().catch(() => '');
    throw new Error(
      body.includes('EntityTooLarge')
        ? IMAGE_UPLOAD_SIZE_ERROR
        : 'Unable to upload the image. Please try again.'
    );
  }
  return intent.uploadToken;
}
