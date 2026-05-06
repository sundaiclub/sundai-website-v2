import { normalizeProjectMarkdown } from '../../src/lib/markdown';

describe('normalizeProjectMarkdown', () => {
  it('converts supported strike html tags to gfm strikethrough', () => {
    expect(normalizeProjectMarkdown('<s>test</s>')).toBe('~~test~~');
    expect(normalizeProjectMarkdown('<strike>old</strike>')).toBe('~~old~~');
    expect(normalizeProjectMarkdown('<del>removed</del>')).toBe('~~removed~~');
  });

  it('preserves markdown that does not need normalization', () => {
    const markdown = `1. test\n    1. nested\n\n~~done~~`;
    expect(normalizeProjectMarkdown(markdown)).toBe(markdown);
  });
});
