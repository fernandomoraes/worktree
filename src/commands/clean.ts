import { defineCommand } from 'citty';

import { withExamples } from '@/lib/examples.js';
import { promptConfirm, promptSelection } from '@/lib/prompts.js';
import {
  collectWorktrees,
  removeWorktreeRow,
  type WorktreeRow,
} from '@/lib/worktrees.js';
import { isInteractive } from '@/utils/is-interactive.js';
import { writeLine } from '@/utils/write-line.js';
import { writeStderrLine } from '@/utils/write-stderr-line.js';

type Candidate = WorktreeRow;

const matches = (candidate: Candidate, branch?: string) =>
  !branch ||
  candidate.branch === branch ||
  candidate.path.endsWith(`/${branch}`);

const selectCandidates = async ({
  candidates,
  branch,
  all,
}: {
  candidates: Candidate[];
  branch?: string;
  all: boolean;
}) => {
  if (branch) {
    const selected = candidates.filter((candidate) =>
      matches(candidate, branch)
    );

    if (selected.length === 0) {
      throw new Error(
        `No worktree found for branch "${branch}".\n  List them with: worktree list`
      );
    }

    return selected;
  }

  if (all) {
    return candidates;
  }

  if (!isInteractive()) {
    throw new Error(
      'Nothing selected.\n  worktree clean --branch <branch>\n  worktree clean --repo <name> --all'
    );
  }

  const chosen = await promptSelection(
    'Worktrees to remove',
    candidates.map((candidate) => ({
      value: candidate.path,
      label: `${candidate.repository}  ${candidate.branch}`,
      hint: candidate.claudeProject ? 'has claude project' : undefined,
    }))
  );

  return candidates.filter((candidate) => chosen.includes(candidate.path));
};

export const clean = withExamples(
  defineCommand({
    meta: {
      name: 'clean',
      description:
        'Remove worktrees and their matching Claude Code project directories',
    },
    args: {
      repo: {
        type: 'string',
        description:
          'Repository name from config, or a path to a git repository',
      },
      branch: {
        type: 'string',
        description: 'Branch of the worktree to remove',
      },
      all: {
        type: 'boolean',
        description: 'Remove every non-primary worktree in scope',
        default: false,
      },
      'delete-branch': {
        type: 'boolean',
        description: 'Also delete the local branch after removing the worktree',
        default: false,
      },
      'keep-claude-project': {
        type: 'boolean',
        description: 'Keep the ~/.claude/projects directory for the worktree',
        default: false,
      },
      force: {
        type: 'boolean',
        description: 'Remove even when the worktree has uncommitted changes',
        default: false,
      },
      yes: {
        type: 'boolean',
        description: 'Skip the confirmation prompt',
        default: false,
      },
      'dry-run': {
        type: 'boolean',
        description: 'Print what would be removed without removing anything',
        default: false,
      },
      verbose: {
        type: 'boolean',
        description: 'Also report each removed worktree in full on stderr',
        default: false,
      },
      config: {
        type: 'string',
        description: 'Path to the config file',
      },
    },
    async run({ args }) {
      const candidates = await collectWorktrees({
        configPath: args.config,
        repository: args.repo,
        includePrimary: false,
      });

      if (candidates.length === 0) {
        if (args.verbose) {
          writeStderrLine('no worktrees to clean');
        }
        return;
      }

      const selected = await selectCandidates({
        candidates,
        branch: args.branch,
        all: args.all,
      });

      if (selected.length === 0) {
        if (args.verbose) {
          writeStderrLine('no worktrees to clean');
        }
        return;
      }

      if (args['dry-run']) {
        if (args.verbose) {
          writeStderrLine(`would remove ${selected.length} worktree(s)`);
        }

        for (const candidate of selected) {
          if (args.verbose) {
            writeStderrLine(`${candidate.repository}  ${candidate.branch}`);
          }

          writeLine(candidate.path);
        }

        if (args.verbose) {
          writeStderrLine('no changes made');
        }

        return;
      }

      if (!args.yes && isInteractive()) {
        const confirmed = await promptConfirm(
          `Remove ${selected.length} worktree(s)?`
        );

        if (!confirmed) {
          if (args.verbose) {
            writeStderrLine('aborted');
          }
          return;
        }
      }

      for (const candidate of selected) {
        const result = await removeWorktreeRow(candidate, {
          force: args.force,
          deleteBranch: args['delete-branch'],
          keepClaudeProject: args['keep-claude-project'],
        });

        if (args.verbose) {
          writeStderrLine('removed worktree');
          writeStderrLine(`repository: ${result.repository}`);
          writeStderrLine(`branch: ${result.branch}`);
          writeStderrLine(`claude_project: ${result.claudeProject}`);
        }

        writeLine(result.path);
      }

      if (args.verbose) {
        writeStderrLine(`removed: ${selected.length}`);
      }
    },
  }),
  [
    'worktree clean --repo vela --branch feature/ABC-123',
    'worktree clean --repo vela --all --dry-run',
    'worktree clean --repo vela --all --yes --delete-branch --verbose',
    'worktree clean                       # interactive multi-select',
  ]
);
