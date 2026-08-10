import { execFile } from 'node:child_process';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  assertLocalBranch,
  baseBranchFor,
  type ResolvedRepository,
} from '@/lib/repository.js';

const run = promisify(execFile);

const createRepository = async (): Promise<ResolvedRepository> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'worktree-repo-')));
  const path = join(root, 'repo');

  await run('git', ['init', '-q', '-b', 'main', path]);
  await run('git', ['-C', path, 'config', 'user.email', 'test@example.com']);
  await run('git', ['-C', path, 'config', 'user.name', 'test']);
  await run('git', ['-C', path, 'commit', '-q', '--allow-empty', '-m', 'init']);

  return { name: 'demo', path, developmentBranch: 'main' };
};

describe('assertLocalBranch', () => {
  it('accepts a branch that exists locally', async () => {
    const repository = await createRepository();

    await expect(assertLocalBranch(repository, 'main')).resolves.toBe('main');
  });

  it('rejects a branch that only exists on a remote', async () => {
    const repository = await createRepository();

    await run('git', [
      '-C',
      repository.path,
      'update-ref',
      'refs/remotes/origin/release',
      'HEAD',
    ]);

    await expect(assertLocalBranch(repository, 'release')).rejects.toThrow(
      /does not exist locally/
    );
  });

  it('names the repository and how to look up branches', async () => {
    const repository = await createRepository();

    await expect(assertLocalBranch(repository, 'nope')).rejects.toThrow(
      new RegExp(
        `demo.*local branches only.*git -C ${repository.path} branch`,
        's'
      )
    );
  });
});

describe('baseBranchFor', () => {
  it('uses the development branch for features', async () => {
    const repository = await createRepository();

    expect(baseBranchFor(repository, 'feature')).toBe('main');
  });

  it('uses the hotfix branch when configured', async () => {
    const repository = {
      ...(await createRepository()),
      hotfixBranch: 'production',
    };

    expect(baseBranchFor(repository, 'hotfix')).toBe('production');
  });

  it('explains what to configure when no hotfix branch is set', async () => {
    const repository = await createRepository();

    expect(() => baseBranchFor(repository, 'hotfix')).toThrow(/hotfixBranch/);
  });
});
