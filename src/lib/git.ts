import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class GitError extends Error {
  readonly stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = 'GitError';
    this.stderr = stderr;
  }
}

export type Worktree = {
  path: string;
  branch: string;
  head: string;
  isPrimary: boolean;
  isLocked: boolean;
};

const git = async (repositoryPath: string, args: string[]) => {
  try {
    const { stdout } = await run('git', ['-C', repositoryPath, ...args], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr).trim()
        : '';
    const message = error instanceof Error ? error.message : String(error);
    throw new GitError(
      stderr || `git ${args.join(' ')} failed: ${message}`,
      stderr
    );
  }
};

export const isGitRepository = async (path: string) => {
  try {
    await git(path, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
};

const parseWorktreeBlock = (block: string, index: number): Worktree => {
  const lines = block.split('\n');
  const value = (prefix: string) =>
    lines.find((line) => line.startsWith(prefix))?.slice(prefix.length) ?? '';

  const branchRef = value('branch ');

  return {
    path: value('worktree '),
    branch: branchRef.replace('refs/heads/', '') || '(detached)',
    head: value('HEAD ').slice(0, 12),
    isPrimary: index === 0,
    isLocked: lines.some((line) => line.startsWith('locked')),
  };
};

export const listWorktrees = async (repositoryPath: string) => {
  const stdout = await git(repositoryPath, ['worktree', 'list', '--porcelain']);

  return stdout
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('worktree '))
    .map(parseWorktreeBlock);
};

export const branchExists = async (
  repositoryPath: string,
  branch: string
): Promise<boolean> => {
  try {
    await git(repositoryPath, [
      'show-ref',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ]);
    return true;
  } catch {
    return false;
  }
};

export const remoteBranchExists = async (
  repositoryPath: string,
  branch: string
): Promise<boolean> => {
  try {
    const stdout = await git(repositoryPath, [
      'ls-remote',
      '--heads',
      'origin',
      branch,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
};

export const fetchRemote = async (repositoryPath: string, branch: string) => {
  await git(repositoryPath, ['fetch', 'origin', branch]);
};

export const defaultBranch = async (repositoryPath: string) => {
  try {
    const stdout = await git(repositoryPath, [
      'symbolic-ref',
      '--short',
      'refs/remotes/origin/HEAD',
    ]);
    return stdout.trim().replace('origin/', '');
  } catch {
    const stdout = await git(repositoryPath, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    return stdout.trim();
  }
};

export const addWorktree = async ({
  repositoryPath,
  worktreePath,
  branch,
  startPoint,
}: {
  repositoryPath: string;
  worktreePath: string;
  branch: string;
  startPoint: string;
}) => {
  const exists = await branchExists(repositoryPath, branch);
  const args = exists
    ? ['worktree', 'add', worktreePath, branch]
    : ['worktree', 'add', '-b', branch, worktreePath, startPoint];

  await git(repositoryPath, args);

  return { reusedBranch: exists };
};

export const removeWorktree = async ({
  repositoryPath,
  worktreePath,
  force,
}: {
  repositoryPath: string;
  worktreePath: string;
  force: boolean;
}) => {
  const args = ['worktree', 'remove', worktreePath];

  if (force) {
    args.push('--force');
  }

  await git(repositoryPath, args);
};

export const deleteBranch = async ({
  repositoryPath,
  branch,
  force,
}: {
  repositoryPath: string;
  branch: string;
  force: boolean;
}) => {
  await git(repositoryPath, ['branch', force ? '-D' : '-d', branch]);
};

export const hasUncommittedChanges = async (worktreePath: string) => {
  const stdout = await git(worktreePath, ['status', '--porcelain']);
  return stdout.trim().length > 0;
};
