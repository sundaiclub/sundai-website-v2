import { render, screen } from '@testing-library/react';

import ProjectDetailLayout from '@/app/projects/[projectId]/layout';
import ProjectsLayout from '@/app/projects/layout';

describe('project route layouts', () => {
  it.each([
    ['projects', ProjectsLayout],
    ['project detail', ProjectDetailLayout],
  ])('keeps the root document shell for the %s route', (_name, Layout) => {
    const { container } = render(
      <Layout>
        <div>Project route content</div>
      </Layout>
    );

    expect(screen.getByText('Project route content')).toBeInTheDocument();
    expect(container.querySelector('html')).not.toBeInTheDocument();
    expect(container.querySelector('body')).not.toBeInTheDocument();
  });
});
