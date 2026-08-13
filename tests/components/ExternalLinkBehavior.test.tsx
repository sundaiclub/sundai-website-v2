import { render, waitFor } from '@testing-library/react';
import ExternalLinkBehavior from '../../src/app/components/ExternalLinkBehavior';

describe('ExternalLinkBehavior', () => {
  it('opens existing external links in a new tab with safe relationships', () => {
    const { getByRole } = render(
      <>
        <ExternalLinkBehavior />
        <a href="https://example.com" rel="author">
          External
        </a>
      </>,
    );

    const link = getByRole('link', { name: 'External' });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'author noopener noreferrer');
  });

  it.each([
    ['/projects', 'Internal'],
    ['#details', 'Page section'],
    ['mailto:team@sundai.club', 'Email'],
    ['tel:+15555550100', 'Telephone'],
  ])('does not change the %s link', (href, label) => {
    const { getByRole } = render(
      <>
        <ExternalLinkBehavior />
        <a href={href}>{label}</a>
      </>,
    );

    const link = getByRole('link', { name: label });

    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
  });

  it('configures external links that are added after the first render', async () => {
    const { container } = render(<ExternalLinkBehavior />);
    const link = document.createElement('a');
    link.href = 'https://example.com/dynamic';
    link.textContent = 'Dynamic external link';

    container.append(link);

    await waitFor(() => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('configures a link when its destination becomes external', async () => {
    const { getByRole } = render(
      <>
        <ExternalLinkBehavior />
        <a href="/projects">Project</a>
      </>,
    );
    const link = getByRole('link', { name: 'Project' });

    link.setAttribute('href', 'https://example.com/project');

    await waitFor(() => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('restores link attributes when its destination becomes internal', async () => {
    const { getByRole } = render(
      <>
        <ExternalLinkBehavior />
        <a href="https://example.com/project" rel="author">
          Project
        </a>
      </>,
    );
    const link = getByRole('link', { name: 'Project' });

    link.setAttribute('href', '/projects');

    await waitFor(() => {
      expect(link).not.toHaveAttribute('target');
      expect(link).toHaveAttribute('rel', 'author');
    });
  });
});
