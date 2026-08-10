import { execFile } from 'node:child_process';
import { mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { addWorktree } from '@/lib/git.js';
import { collectWorktrees, removeWorktreeRow } from '@/lib/worktrees.js';

const run = promisify(execFile);

const createRepositoryWithWorktree = async () => {
  // git reports resolved paths, and macOS maps /var to /private/var.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'worktree-rows-')));
  const path = join(root, 'repo');

  await run('git', ['init', '-q', '-b', 'main', path]);
  await run('git', ['-C', path, 'config', 'user.email', 'test@example.com']);
  await run('git', ['-C', path, 'config', 'user.name', 'test']);
  await run('git', ['-C', path, 'commit', '-q', '--allow-empty', '-m', 'init']);

  const worktreePath = join(root, 'feature');

  await addWorktree({
    repositoryPath: path,
    worktreePath,
    branch: 'feature/demo',
    startPoint: 'main',
  });

  return { root, path, worktreePath };
};

const writeConfig = async (root: string, repositories: unknown[]) => {
  const configPath = join(root, 'config.json');
  await writeFile(
    configPath,
    JSON.stringify({ worktreesPath: root, repositories })
  );
  return configPath;
};

describe('collectWorktrees', () => {
  it('returns one row per worktree, excluding the primary', async () => {
    const { root, path, worktreePath } = await createRepositoryWithWorktree();
    const configPath = await writeConfig(root, [{ name: 'demo', path }]);

    const rows = await collectWorktrees({
      configPath,
      includePrimary: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      repository: 'demo',
      repositoryPath: path,
      branch: 'feature/demo',
      path: worktreePath,
      primary: false,
    });
  });

  it('lists a worktree once even when several config entries point at the same repository', async () => {
    const { root, path } = await createRepositoryWithWorktree();
    const configPath = await writeConfig(root, [
      { name: 'one', path },
      { name: 'two', path },
      { name: 'three', path },
    ]);

    const rows = await collectWorktrees({ configPath, includePrimary: false });

    expect(rows).toHaveLength(1);
    expect(rows.map((row) => row.path)).toEqual([
      ...new Set(rows.map((row) => row.path)),
    ]);
  });

  it('includes the primary worktree on request', async () => {
    const { root, path } = await createRepositoryWithWorktree();
    const configPath = await writeConfig(root, [{ name: 'demo', path }]);

    const rows = await collectWorktrees({ configPath, includePrimary: true });

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.primary)).toHaveLength(1);
  });
});

describe('removeWorktreeRow', () => {
  it('removes the worktree and reports what happened', async () => {
    const { root, path } = await createRepositoryWithWorktree();
    const configPath = await writeConfig(root, [{ name: 'demo', path }]);
    const [row] = await collectWorktrees({ configPath, includePrimary: false });

    const result = await removeWorktreeRow(row!, {
      force: false,
      deleteBranch: false,
      keepClaudeProject: false,
    });

    expect(result).toMatchObject({
      repository: 'demo',
      branch: 'feature/demo',
      claudeProject: 'none',
    });

    await expect(
      collectWorktrees({ configPath, includePrimary: false })
    ).resolves.toEqual([]);
  });

  it('refuses to remove a worktree with uncommitted changes', async () => {
    const { root, path, worktreePath } = await createRepositoryWithWorktree();
    const configPath = await writeConfig(root, [{ name: 'demo', path }]);
    const [row] = await collectWorktrees({ configPath, includePrimary: false });

    await writeFile(join(worktreePath, 'scratch.txt'), 'dirty');

    await expect(
      removeWorktreeRow(row!, {
        force: false,
        deleteBranch: false,
        keepClaudeProject: false,
      })
    ).rejects.toThrow(/uncommitted changes.*--force/s);
  });

  it('reports a kept claude project when asked to keep it', async () => {
    const { root, path } = await createRepositoryWithWorktree();
    const configPath = await writeConfig(root, [{ name: 'demo', path }]);
    const [row] = await collectWorktrees({ configPath, includePrimary: false });

    const result = await removeWorktreeRow(row!, {
      force: false,
      deleteBranch: true,
      keepClaudeProject: true,
    });

    expect(result.claudeProject).toBe('kept');
  });
});
