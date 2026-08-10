import { defineCommand } from 'citty';

import { collectWorktrees } from '@/commands/list.js';
import { removeClaudeProject } from '@/lib/claude-projects.js';
import { withExamples } from '@/lib/examples.js';
import {
  deleteBranch,
  hasUncommittedChanges,
  removeWorktree,
} from '@/lib/git.js';
import { promptConfirm, promptSelection } from '@/lib/prompts.js';
import { isInteractive } from '@/utils/is-interactive.js';
import { writeLine } from '@/utils/write-line.js';

type Candidate = Awaited<ReturnType<typeof collectWorktrees>>[number];

const describeClaudeProjectRemoval = async (worktreePath: string) => {
  const { path, removed } = await removeClaudeProject(worktreePath);
  return removed ? path : 'none';
};

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
        writeLine('no worktrees to clean');
        return;
      }

      const selected = await selectCandidates({
        candidates,
        branch: args.branch,
        all: args.all,
      });

      if (selected.length === 0) {
        writeLine('no worktrees to clean');
        return;
      }

      if (args['dry-run']) {
        writeLine(`would remove ${selected.length} worktree(s)`);
        for (const candidate of selected) {
          writeLine(
            [candidate.repository, candidate.branch, candidate.path].join('\t')
          );
        }
        writeLine('no changes made');
        return;
      }

      if (!args.yes && isInteractive()) {
        const confirmed = await promptConfirm(
          `Remove ${selected.length} worktree(s)?`
        );

        if (!confirmed) {
          writeLine('aborted');
          return;
        }
      }

      let removed = 0;

      for (const candidate of selected) {
        if (!args.force && (await hasUncommittedChanges(candidate.path))) {
          throw new Error(
            `Worktree has uncommitted changes: ${candidate.path}\n  Commit them, or re-run with --force.`
          );
        }

        const repositoryPath = candidate.repositoryPath;

        await removeWorktree({
          repositoryPath,
          worktreePath: candidate.path,
          force: args.force,
        });

        const claudeProject = args['keep-claude-project']
          ? 'kept'
          : await describeClaudeProjectRemoval(candidate.path);

        if (args['delete-branch']) {
          await deleteBranch({
            repositoryPath,
            branch: candidate.branch,
            force: args.force,
          });
        }

        removed += 1;

        writeLine('removed worktree');
        writeLine(`repository: ${candidate.repository}`);
        writeLine(`branch: ${candidate.branch}`);
        writeLine(`path: ${candidate.path}`);
        writeLine(`claude_project: ${claudeProject}`);
      }

      writeLine(`removed: ${removed}`);
    },
  }),
  [
    'worktree clean --repo vela --branch feature/ABC-123',
    'worktree clean --repo vela --all --dry-run',
    'worktree clean --repo vela --all --yes --delete-branch',
    'worktree clean                       # interactive multi-select',
  ]
);
