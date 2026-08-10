import { defineCommand } from 'citty';

import { claudeProjectExists } from '@/lib/claude-projects.js';
import { loadConfig } from '@/lib/config.js';
import { listWorktrees, type Worktree } from '@/lib/git.js';
import {
  resolveAllRepositories,
  resolveRepository,
  type ResolvedRepository,
} from '@/lib/repository.js';
import { writeLine } from '@/utils/write-line.js';

type Row = {
  repository: string;
  repositoryPath: string;
  branch: string;
  path: string;
  head: string;
  primary: boolean;
  locked: boolean;
  claudeProject: boolean;
};

const toRows = async (repository: ResolvedRepository, worktrees: Worktree[]) =>
  Promise.all(
    worktrees.map(async (worktree) => ({
      repository: repository.name,
      repositoryPath: repository.path,
      branch: worktree.branch,
      path: worktree.path,
      head: worktree.head,
      primary: worktree.isPrimary,
      locked: worktree.isLocked,
      claudeProject: await claudeProjectExists(worktree.path),
    }))
  );

export const collectWorktrees = async ({
  configPath,
  repository,
  includePrimary,
}: {
  configPath?: string;
  repository?: string;
  includePrimary: boolean;
}): Promise<Row[]> => {
  const { config } = await loadConfig(configPath);

  const repositories = repository
    ? [await resolveRepository(config, repository)]
    : await resolveAllRepositories(config);

  if (repositories.length === 0) {
    throw new Error(
      'No repositories configured.\n  Add one with: worktree config init\n  Or target a repository directly: worktree list --repo ./path/to/repo'
    );
  }

  const rows: Row[] = [];

  for (const resolved of repositories) {
    const worktrees = await listWorktrees(resolved.path);
    rows.push(...(await toRows(resolved, worktrees)));
  }

  return includePrimary ? rows : rows.filter((row) => !row.primary);
};

export const list = defineCommand({
  meta: {
    name: 'list',
    description: 'List git worktrees across configured repositories',
  },
  args: {
    repo: {
      type: 'string',
      description: 'Repository name from config, or a path to a git repository',
    },
    all: {
      type: 'boolean',
      description: 'Include the primary worktree of each repository',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON instead of tab-separated values',
      default: false,
    },
    config: {
      type: 'string',
      description: 'Path to the config file',
    },
  },
  async run({ args }) {
    const rows = await collectWorktrees({
      configPath: args.config,
      repository: args.repo,
      includePrimary: args.all,
    });

    if (args.json) {
      writeLine(JSON.stringify(rows, undefined, 2));
      return;
    }

    for (const row of rows) {
      writeLine([row.repository, row.branch, row.path].join('\t'));
    }
  },
});
