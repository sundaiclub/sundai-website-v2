import { imagePublicUrl, rewriteImageReferences } from '@/lib/imageMigration';

const image = {
  key: 'projects/photo one.png',
  size: 12,
  md5: 'checksum',
  contentType: 'image/png',
};
const copies = new Map([[image.key, image]]);
const rewrite = (value: unknown) =>
  rewriteImageReferences(
    value,
    'club-site-images',
    'https://cdn.example.com',
    copies
  );

it('rewrites Markdown and HTML images, including nested JSON values', () => {
  const result = rewrite({
    body: '![photo](<https://storage.googleapis.com/club-site-images/projects/photo%20one.png>)',
    details: [
      '<img src="https://storage.googleapis.com/club-site-images/projects/photo%20one.png">',
    ],
  });
  expect(result.value).toEqual({
    body: '![photo](<https://cdn.example.com/projects/photo%20one.png>)',
    details: ['<img src="https://cdn.example.com/projects/photo%20one.png">'],
  });
  expect(result.keys).toEqual([image.key]);
  expect(result.unresolved).toEqual([]);
});

it('reports uncopied objects and leaves other buckets and Clerk URLs intact', () => {
  const value =
    'https://storage.googleapis.com/club-site-images/projects/missing.png https://storage.googleapis.com/private-materials/a.png https://img.clerk.com/avatar';
  const result = rewrite(value);
  expect(result.value).toBe(value);
  expect(result.unresolved).toEqual([
    'https://storage.googleapis.com/club-site-images/projects/missing.png',
  ]);
});

it('preserves prose punctuation and handles encoded slashes', () => {
  expect(
    rewrite(
      'See https://storage.googleapis.com/club-site-images/projects%2Fphoto%20one.png.'
    ).value
  ).toBe('See https://cdn.example.com/projects/photo%20one.png.');
});

it('is idempotent after the cutover', () => {
  const value = '![photo](https://cdn.example.com/projects/photo%20one.png)';
  expect(rewrite(value).value).toBe(value);
  expect(rewrite(value).keys).toEqual([]);
});

it('encodes Markdown delimiter characters in public URLs', () => {
  expect(imagePublicUrl('https://cdn.example.com/', "projects/(a)'b.png")).toBe(
    'https://cdn.example.com/projects/%28a%29%27b.png'
  );
});
