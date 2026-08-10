import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  addWorktree,
  branchExists,
  hasUncommittedChanges,
  isGitRepository,
  listWorktrees,
  removeWorktree,
} from '@/lib/git.js';

const run = promisify(execFile);

const createRepository = async () => {
  const root = await mkdtemp(join(tmpdir(), 'worktree-git-'));
  const path = join(root, 'repo');

  await run('git', ['init', '-q', '-b', 'main', path]);
  await run('git', ['-C', path, 'config', 'user.email', 'test@example.com']);
  await run('git', ['-C', path, 'config', 'user.name', 'test']);
  await run('git', ['-C', path, 'commit', '-q', '--allow-empty', '-m', 'init']);

  return { root, path };
};

describe('isGitRepository', () => {
  it('is false for a plain directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'worktree-plain-'));
    expect(await isGitRepository(root)).toBe(false);
  });

  it('is true for a git repository', async () => {
    const { path } = await createRepository();
    expect(await isGitRepository(path)).toBe(true);
  });
});

describe('worktree lifecycle', () => {
  it('adds, lists and removes a worktree', async () => {
    const { root, path } = await createRepository();
    const worktreePath = join(root, 'feature');

    const { reusedBranch } = await addWorktree({
      repositoryPath: path,
      worktreePath,
      branch: 'feature/demo',
      startPoint: 'main',
    });

    expect(reusedBranch).toBe(false);
    expect(await branchExists(path, 'feature/demo')).toBe(true);

    const worktrees = await listWorktrees(path);

    expect(worktrees).toHaveLength(2);
    expect(worktrees[0]?.isPrimary).toBe(true);
    expect(worktrees[1]).toMatchObject({
      branch: 'feature/demo',
      isPrimary: false,
      isLocked: false,
    });

    await removeWorktree({
      repositoryPath: path,
      worktreePath,
      force: false,
    });

    expect(await listWorktrees(path)).toHaveLength(1);
  });

  it('reuses an existing branch instead of recreating it', async () => {
    const { root, path } = await createRepository();

    await run('git', ['-C', path, 'branch', 'feature/existing']);

    const { reusedBranch } = await addWorktree({
      repositoryPath: path,
      worktreePath: join(root, 'existing'),
      branch: 'feature/existing',
      startPoint: 'main',
    });

    expect(reusedBranch).toBe(true);
  });

  it('detects uncommitted changes in a worktree', async () => {
    const { root, path } = await createRepository();
    const worktreePath = join(root, 'dirty');

    await addWorktree({
      repositoryPath: path,
      worktreePath,
      branch: 'feature/dirty',
      startPoint: 'main',
    });

    expect(await hasUncommittedChanges(worktreePath)).toBe(false);

    await run('touch', [join(worktreePath, 'scratch.txt')]);

    expect(await hasUncommittedChanges(worktreePath)).toBe(true);
  });
});
