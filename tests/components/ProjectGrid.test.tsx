import { act, render, screen, waitFor } from '../utils/test-utils'
import ProjectGrid from '../../src/app/components/Project'
import { mockProject } from '../utils/test-utils'

function makeProject(id: string, title: string, startDate: string) {
  return {
    ...mockProject,
    id,
    title,
    startDate: new Date(startDate),
    createdAt: new Date(startDate).toISOString(),
    updatedAt: new Date(startDate).toISOString(),
  }
}

describe('ProjectGrid', () => {
  let observerEntries: Array<{
    callback: (entries: Array<{ isIntersecting: boolean }>) => void
    target?: Element
  }>

  beforeEach(() => {
    jest.clearAllMocks()
    observerEntries = []

    global.IntersectionObserver = class MockIntersectionObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerEntries.push({ callback })
      }

      observe(target: Element) {
        observerEntries[observerEntries.length - 1].target = target
      }
      disconnect() {}
      unobserve() {}
    } as typeof IntersectionObserver
  })

  it('loads the next page when the sentinel enters the viewport', async () => {
    const firstProject = makeProject('project-1', 'Project 1', '2024-02-02T00:00:00Z')
    const secondProject = makeProject('project-2', 'Project 2', '2024-02-01T00:00:00Z')

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          projects: [firstProject],
          hasMore: true,
          totalCount: 2,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          projects: [secondProject],
          hasMore: false,
          totalCount: 2,
        }),
      })

    render(
      <ProjectGrid
        enablePagination={true}
        showSearch={false}
        statusFilter="APPROVED"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/projects?status=APPROVED&limit=18&offset=0'
    )

    await waitFor(() => {
      expect(observerEntries.length).toBeGreaterThan(0)
    })

    const sentinel = document.querySelector('[aria-hidden="true"]')
    const sentinelObserver = observerEntries.find((entry) => entry.target === sentinel)

    await act(async () => {
      sentinelObserver?.callback([{ isIntersecting: true }])
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/projects?status=APPROVED&limit=18&offset=1'
    )

    await waitFor(() => {
      expect(screen.getByText('Project 2')).toBeInTheDocument()
    })
  })

  it('shows the total Sundai project count from paginated responses', async () => {
    const firstProject = makeProject('project-1', 'Project 1', '2024-02-02T00:00:00Z')

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        projects: [firstProject],
        hasMore: true,
        totalCount: 42,
      }),
    })

    render(
      <ProjectGrid
        enablePagination={true}
        showSearch={true}
        statusFilter="APPROVED"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument()
    })

    expect(screen.getByText('42').parentElement).toHaveTextContent('42 projects found')
  })
})
