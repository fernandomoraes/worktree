import { basename } from 'node:path';

import { findRepository, type Config } from '@/lib/config.js';
import { branchExists, defaultBranch, isGitRepository } from '@/lib/git.js';
import { expandHome } from '@/utils/expand-home.js';

import type { WorktreeType } from '@/lib/branch-name.js';

export type ResolvedRepository = {
  name: string;
  path: string;
  developmentBranch: string;
  hotfixBranch?: string;
};

const describeAvailable = (config: Config) => {
  if (config.repositories.length === 0) {
    return 'No repositories are configured. Add one with: worktree config init';
  }

  const names = config.repositories
    .map((repository) => repository.name)
    .join(', ');

  return `Configured repositories: ${names}`;
};

const fromPath = async (path: string): Promise<ResolvedRepository> => {
  const absolute = expandHome(path);

  if (!(await isGitRepository(absolute))) {
    throw new Error(`Not a git repository: ${absolute}`);
  }

  return {
    name: basename(absolute),
    path: absolute,
    developmentBranch: await defaultBranch(absolute),
  };
};

export const resolveRepository = async (
  config: Config,
  reference: string
): Promise<ResolvedRepository> => {
  const configured = findRepository(config, reference);

  if (configured) {
    const path = expandHome(configured.path);

    if (!(await isGitRepository(path))) {
      throw new Error(
        `Repository "${configured.name}" points to ${path}, which is not a git repository.`
      );
    }

    return { ...configured, path };
  }

  if (reference.includes('/') || reference.startsWith('.')) {
    return fromPath(reference);
  }

  throw new Error(
    `Unknown repository "${reference}".\n  ${describeAvailable(config)}`
  );
};

export const resolveAllRepositories = async (config: Config) => {
  const resolved: ResolvedRepository[] = [];

  for (const repository of config.repositories) {
    resolved.push(await resolveRepository(config, repository.name));
  }

  return resolved;
};

export const baseBranchFor = (
  repository: ResolvedRepository,
  type: WorktreeType
) => {
  if (type === 'hotfix') {
    if (!repository.hotfixBranch) {
      throw new Error(
        `Repository "${repository.name}" has no hotfixBranch configured.\n  Add "hotfixBranch" to the repository entry in your config file.`
      );
    }

    return repository.hotfixBranch;
  }

  return repository.developmentBranch;
};

/**
 * Worktrees are always cut from a local branch: talking to the remote can mean
 * waiting on a VPN, so `create` never reaches the network.
 */
export const assertLocalBranch = async (
  repository: ResolvedRepository,
  branch: string
) => {
  if (await branchExists(repository.path, branch)) {
    return branch;
  }

  throw new Error(
    `Branch "${branch}" does not exist locally in ${repository.name} (${repository.path}).\n` +
      `  Worktrees are created from local branches only.\n` +
      `  Fetch or create it first, or pass --base <branch>.\n` +
      `  See what you have: git -C ${repository.path} branch`
  );
};
