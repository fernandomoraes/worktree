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

export type WorktreeName = {
  /** Full name, ticket key plus summary — used for the branch. */
  branch: string;
  /** Short name — used for the directory on disk. */
  directory: string;
};

export const buildWorktreeName = ({
  ticket,
  description,
}: {
  ticket?: string;
  description?: string;
}): WorktreeName => {
  const key = ticket?.toUpperCase();
  const branch = [key, slugify(description ?? '')].filter(Boolean).join('-');

  if (!branch) {
    throw new Error('Cannot derive a worktree name from empty input.');
  }

  // A Jira summary makes for a long path, and the key alone already identifies
  // the worktree; the branch keeps the summary for readability.
  return { branch, directory: key ?? branch };
};

export const buildBranchName = ({
  type,
  name,
}: {
  type: WorktreeType;
  name: string;
}) => `${type}/${name}`;
