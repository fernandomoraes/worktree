import { defineCommand } from 'citty';

import { withExamples } from '@/lib/examples.js';
import { promptAction, promptConfirm, promptSelection } from '@/lib/prompts.js';
import { actionsFor } from '@/lib/worktree-actions.js';
import {
  collectWorktrees,
  removeWorktreeRow,
  type WorktreeRow,
} from '@/lib/worktrees.js';
import { isInteractive } from '@/utils/is-interactive.js';
import { writeLine } from '@/utils/write-line.js';
import { writeStderrLine } from '@/utils/write-stderr-line.js';

const selectRows = async (rows: WorktreeRow[]) => {
  const chosen = await promptSelection(
    'Worktrees',
    rows.map((row) => ({
      value: row.path,
      label: `${row.repository}  ${row.branch}`,
      hint: row.claudeProject ? 'has claude project' : undefined,
    }))
  );

  return rows.filter((row) => chosen.includes(row.path));
};

const deleteRows = async ({
  rows,
  force,
  deleteBranch,
  keepClaudeProject,
  skipConfirm,
}: {
  rows: WorktreeRow[];
  force: boolean;
  deleteBranch: boolean;
  keepClaudeProject: boolean;
  skipConfirm: boolean;
}) => {
  if (
    !skipConfirm &&
    !(await promptConfirm(`Remove ${rows.length} worktree(s)?`))
  ) {
    writeStderrLine('aborted');
    return;
  }

  for (const row of rows) {
    const result = await removeWorktreeRow(row, {
      force,
      deleteBranch,
      keepClaudeProject,
    });

    writeStderrLine(`removed ${result.repository} ${result.branch}`);
    writeStderrLine(`  path: ${result.path}`);
    writeStderrLine(`  claude_project: ${result.claudeProject}`);
  }

  writeStderrLine(`removed: ${rows.length}`);
};

export const pick = withExamples(
  defineCommand({
    meta: {
      name: 'pick',
      description: 'Select a worktree to open (prints its path) or delete',
    },
    args: {
      repo: {
        type: 'string',
        description:
          'Repository name from config, or a path to a git repository',
      },
      'delete-branch': {
        type: 'boolean',
        description: 'When deleting, also delete the local branch',
        default: false,
      },
      'keep-claude-project': {
        type: 'boolean',
        description:
          'When deleting, keep the ~/.claude/projects directory for the worktree',
        default: false,
      },
      force: {
        type: 'boolean',
        description: 'When deleting, allow worktrees with uncommitted changes',
        default: false,
      },
      yes: {
        type: 'boolean',
        description: 'Skip the delete confirmation prompt',
        default: false,
      },
      config: {
        type: 'string',
        description: 'Path to the config file',
      },
    },
    async run({ args }) {
      if (!isInteractive()) {
        throw new Error(
          '`worktree pick` needs an interactive terminal.\n  Use `worktree list` for plain output.'
        );
      }

      const rows = await collectWorktrees({
        configPath: args.config,
        repository: args.repo,
        includePrimary: false,
      });

      if (rows.length === 0) {
        writeStderrLine('no worktrees');
        return;
      }

      const selected = await selectRows(rows);

      if (selected.length === 0) {
        writeStderrLine('nothing selected');
        return;
      }

      const [only] = selected;
      const actions = actionsFor(selected.length);
      const action =
        actions.length === 1 ? actions[0] : await promptAction(actions);

      if (action === 'open' && only) {
        writeLine(only.path);
        return;
      }

      await deleteRows({
        rows: selected,
        force: args.force,
        deleteBranch: args['delete-branch'],
        keepClaudeProject: args['keep-claude-project'],
        skipConfirm: args.yes,
      });
    },
  }),
  [
    'worktree pick',
    'cd "$(worktree pick)"          # jump into the selected worktree',
    'worktree pick --repo vela',
    'worktree pick --yes --delete-branch',
  ]
);
