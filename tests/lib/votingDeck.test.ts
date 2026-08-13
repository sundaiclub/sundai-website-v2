import { reconcileVoteDeckIds } from '../../src/lib/votingDeck';

describe('reconcileVoteDeckIds', () => {
  it('preserves the existing deck order when eligible ids arrive in a different order', () => {
    const nextDeck = reconcileVoteDeckIds(
      ['project-a', 'project-b', 'project-c'],
      ['project-c', 'project-a', 'project-b'],
      new Set()
    );

    expect(nextDeck).toEqual(['project-a', 'project-b', 'project-c']);
  });

  it('removes seen projects and appends newly eligible projects', () => {
    const nextDeck = reconcileVoteDeckIds(
      ['project-a', 'project-b', 'project-c'],
      ['project-c', 'project-d', 'project-a'],
      new Set(['project-a'])
    );

    expect(nextDeck).toEqual(['project-c', 'project-d']);
  });
});
