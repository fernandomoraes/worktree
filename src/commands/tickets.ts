import { defineCommand } from 'citty';

import { withExamples } from '@/lib/examples.js';
import { fetchAssignedIssues } from '@/lib/jira.js';
import { writeLine } from '@/utils/write-line.js';

export const tickets = withExamples(
  defineCommand({
    meta: {
      name: 'tickets',
      description: 'List Jira issues assigned to you in the current sprint',
    },
    args: {
      'all-issues': {
        type: 'boolean',
        description:
          'List every open issue assigned to you, not just the current sprint',
        default: false,
      },
      limit: {
        type: 'string',
        description: 'Maximum number of issues to return (default: 50)',
      },
      json: {
        type: 'boolean',
        description: 'Emit JSON instead of tab-separated values',
        default: false,
      },
    },
    async run({ args }) {
      const limit = args.limit ? Number(args.limit) : undefined;

      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
        throw new Error(
          `Invalid --limit "${args.limit}". Expected a positive integer.`
        );
      }

      const issues = await fetchAssignedIssues({
        currentSprintOnly: !args['all-issues'],
        limit,
      });

      if (args.json) {
        writeLine(JSON.stringify(issues, undefined, 2));
        return;
      }

      for (const issue of issues) {
        writeLine([issue.key, issue.status, issue.summary].join('\t'));
      }
    },
  }),
  [
    'worktree tickets',
    'worktree tickets --json',
    'worktree tickets --all-issues',
    'worktree create --repo vela --ticket "$(worktree tickets | head -1 | cut -f1)"',
  ]
);
