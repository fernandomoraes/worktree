import { defineCommand } from 'citty';

import { withExamples } from '@/lib/examples.js';
import { collectWorktrees } from '@/lib/worktrees.js';
import { writeLine } from '@/utils/write-line.js';

export const list = withExamples(
  defineCommand({
    meta: {
      name: 'list',
      description: 'List git worktrees across configured repositories',
    },
    args: {
      repo: {
        type: 'string',
        description:
          'Repository name from config, or a path to a git repository',
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
  }),
  [
    'worktree list',
    'worktree list --json',
    'worktree list --repo vela',
    'worktree list --all           # include each primary worktree',
    'worktree pick                 # select one interactively instead',
  ]
);
