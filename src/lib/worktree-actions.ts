export const WORKTREE_ACTIONS = ['open', 'delete'] as const;

export type WorktreeAction = (typeof WORKTREE_ACTIONS)[number];

export const actionsFor = (selectedCount: number): WorktreeAction[] => {
  if (selectedCount === 1) {
    return ['open', 'delete'];
  }

  return ['delete'];
};
