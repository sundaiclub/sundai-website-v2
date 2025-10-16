import { markdownToHtml } from '../../src/lib/markdownToHtml'

describe('markdownToHtml', () => {
  it('converts bullet list and links', () => {
    const md = `- First item\n- Visit [VectorLab](https://vectorlab.dev)`
    const html = markdownToHtml(md)
    expect(html).toContain('<ul')
    expect(html).toContain('<li>First item</li>')
    expect(html).toContain('<a href="https://vectorlab.dev"')
    expect(html).toContain('VectorLab')
  })

  it('handles empty input', () => {
    expect(markdownToHtml('')).toBe('')
  })
})


