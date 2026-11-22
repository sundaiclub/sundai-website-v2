import { guideEmbedUrl } from '../../src/lib/eventGuide';

describe('guideEmbedUrl', () => {
  it.each([
    'https://docs.google.com/presentation/d/fake-deck_1/edit?usp=sharing',
    'https://docs.google.com/presentation/d/fake-deck_1/edit#slide=id.p',
    'https://docs.google.com/presentation/d/fake-deck_1/',
    'https://docs.google.com/presentation/d/fake-deck_1/embed',
  ])('embeds the Google Slides link %s', url => {
    expect(guideEmbedUrl(url)).toBe(
      'https://docs.google.com/presentation/d/fake-deck_1/embed?start=false&loop=false&delayms=3000'
    );
  });

  it('embeds a published Google Slides link', () => {
    expect(
      guideEmbedUrl('https://docs.google.com/presentation/d/e/2PACX-fake/pub')
    ).toBe(
      'https://docs.google.com/presentation/d/e/2PACX-fake/embed?start=false&loop=false&delayms=3000'
    );
  });

  it('keeps other links as they are', () => {
    expect(guideEmbedUrl('https://example.com/guide?page=2')).toBe(
      'https://example.com/guide?page=2'
    );
  });
});
