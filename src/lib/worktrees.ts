import { loadConfig } from '@/lib/config.js';
import {
  deleteBranch,
  hasUncommittedChanges,
  listWorktrees,
  removeWorktree,
  type Worktree,
} from '@/lib/git.js';
import {
  resolveAllRepositories,
  resolveRepository,
  type ResolvedRepository,
} from '@/lib/repository.js';

export type WorktreeRow = {
  repository: string;
  repositoryPath: string;
  branch: string;
  path: string;
  head: string;
  primary: boolean;
  locked: boolean;
};

const toRows = (
  repository: ResolvedRepository,
  worktrees: Worktree[]
): WorktreeRow[] =>
  worktrees.map((worktree) => ({
    repository: repository.name,
    repositoryPath: repository.path,
    branch: worktree.branch,
    path: worktree.path,
    head: worktree.head,
    primary: worktree.isPrimary,
    locked: worktree.isLocked,
  }));

const dedupeByPath = (rows: WorktreeRow[]) => {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (seen.has(row.path)) {
      return false;
    }

    seen.add(row.path);
    return true;
  });
};

export const collectWorktrees = async ({
  configPath,
  repository,
  includePrimary,
}: {
  configPath?: string;
  repository?: string;
  includePrimary: boolean;
}): Promise<WorktreeRow[]> => {
  const { config } = await loadConfig(configPath);

  const repositories = repository
    ? [await resolveRepository(config, repository)]
    : await resolveAllRepositories(config);

  if (repositories.length === 0) {
    throw new Error(
      'No repositories configured.\n  Add one with: worktree config init\n  Or target a repository directly: worktree list --repo ./path/to/repo'
    );
  }

  const rows: WorktreeRow[] = [];

  for (const resolved of repositories) {
    rows.push(...toRows(resolved, await listWorktrees(resolved.path)));
  }

  const unique = dedupeByPath(rows);

  return includePrimary ? unique : unique.filter((row) => !row.primary);
};

export type RemovalOptions = {
  force: boolean;
  deleteBranch: boolean;
};

export type RemovalResult = {
  repository: string;
  branch: string;
  path: string;
};

export const removeWorktreeRow = async (
  row: WorktreeRow,
  options: RemovalOptions
): Promise<RemovalResult> => {
  if (!options.force && (await hasUncommittedChanges(row.path))) {
    throw new Error(
      `Worktree has uncommitted changes: ${row.path}\n  Commit them, or re-run with --force.`
    );
  }

  await removeWorktree({
    repositoryPath: row.repositoryPath,
    worktreePath: row.path,
    force: options.force,
  });

  if (options.deleteBranch) {
    await deleteBranch({
      repositoryPath: row.repositoryPath,
      branch: row.branch,
      force: options.force,
    });
  }

  return {
    repository: row.repository,
    branch: row.branch,
    path: row.path,
  };
};
