import { actionsFor } from '@/lib/worktree-actions.js';

describe('actionsFor', () => {
  it('offers open and delete for a single selection', () => {
    expect(actionsFor(1)).toEqual(['open', 'delete']);
  });

  it('offers only delete once more than one is selected', () => {
    expect(actionsFor(2)).toEqual(['delete']);
    expect(actionsFor(9)).toEqual(['delete']);
  });

  it('offers only delete for an empty selection', () => {
    expect(actionsFor(0)).toEqual(['delete']);
  });
});
