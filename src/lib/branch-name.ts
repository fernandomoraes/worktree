import { slugify } from '@/utils/slugify.js';

export const WORKTREE_TYPES = ['feature', 'hotfix'] as const;

export type WorktreeType = (typeof WORKTREE_TYPES)[number];

export const isWorktreeType = (value: string): value is WorktreeType =>
  WORKTREE_TYPES.includes(value as WorktreeType);

export const assertWorktreeType = (value: string): WorktreeType => {
  if (!isWorktreeType(value)) {
    throw new Error(
      `Invalid type "${value}". Expected one of: ${WORKTREE_TYPES.join(', ')}`
    );
  }

  return value;
};

export const buildWorktreeName = ({
  ticket,
  description,
}: {
  ticket?: string;
  description?: string;
}) => {
  const name = [ticket?.toUpperCase(), slugify(description ?? '')]
    .filter(Boolean)
    .join('-');

  if (!name) {
    throw new Error('Cannot derive a worktree name from empty input.');
  }

  return name;
};

export const buildBranchName = ({
  type,
  name,
}: {
  type: WorktreeType;
  name: string;
}) => `${type}/${name}`;
