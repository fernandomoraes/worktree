import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { defineCommand } from 'citty';

import {
  assertWorktreeType,
  buildBranchName,
  buildWorktreeName,
  WORKTREE_TYPES,
  type WorktreeName,
  type WorktreeType,
} from '@/lib/branch-name.js';
import { loadConfig, worktreesRoot, type Config } from '@/lib/config.js';
import { withExamples } from '@/lib/examples.js';
import { addWorktree, branchExists } from '@/lib/git.js';
import { fetchAssignedIssues, fetchIssue, type JiraIssue } from '@/lib/jira.js';
import {
  promptIssue,
  promptNameSource,
  promptRepository,
  promptText,
  promptType,
} from '@/lib/prompts.js';
import {
  assertLocalBranch,
  baseBranchFor,
  resolveRepository,
  type ResolvedRepository,
} from '@/lib/repository.js';
import { isInteractive } from '@/utils/is-interactive.js';
import { logger } from '@/utils/logger.js';
import { writeLine } from '@/utils/write-line.js';
import { writeStderrLine } from '@/utils/write-stderr-line.js';

const pathExists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const resolveType = async (
  value: string | undefined
): Promise<WorktreeType> => {
  if (value) {
    return assertWorktreeType(value);
  }

  if (isInteractive()) {
    return promptType();
  }

  return 'feature';
};

const resolveTargetRepository = async (
  config: Config,
  reference: string | undefined
): Promise<ResolvedRepository> => {
  if (reference) {
    return resolveRepository(config, reference);
  }

  if (isInteractive() && config.repositories.length > 0) {
    return resolveRepository(config, await promptRepository(config));
  }

  throw new Error(
    'No repository specified.\n  worktree create --repo <name|path> --ticket <KEY>\n  Configured repositories: worktree config show'
  );
};

const nameFromIssue = (issue: JiraIssue, override?: string) => {
  logger.debug(`using jira issue ${issue.key}: ${issue.summary}`);

  return buildWorktreeName({
    ticket: issue.key,
    description: override ?? issue.summary,
  });
};

const pickIssue = async (currentSprintOnly: boolean) => {
  const issues = await fetchAssignedIssues({ currentSprintOnly });

  if (issues.length === 0) {
    throw new Error(
      currentSprintOnly
        ? 'No open issues assigned to you in the current sprint.\n  Re-run with --all-issues to list every open issue assigned to you.'
        : 'No open issues assigned to you.\n  Use --name to create a worktree without a ticket.'
    );
  }

  const key = await promptIssue(issues);
  const issue = issues.find((candidate) => candidate.key === key);

  if (!issue) {
    throw new Error(`Selected issue ${key} is no longer in the list.`);
  }

  return issue;
};

const resolveName = async ({
  ticket,
  name,
  allIssues,
}: {
  ticket?: string;
  name?: string;
  allIssues: boolean;
}): Promise<WorktreeName> => {
  if (ticket) {
    return nameFromIssue(await fetchIssue(ticket), name);
  }

  if (name) {
    return buildWorktreeName({ description: name });
  }

  if (!isInteractive()) {
    throw new Error(
      'No ticket or name provided.\n  worktree create --repo <name> --ticket ABC-123\n  worktree create --repo <name> --name "fix login redirect"\n  Discover your tickets with: worktree tickets'
    );
  }

  if ((await promptNameSource()) === 'free-form') {
    return buildWorktreeName({
      description: await promptText('Worktree name'),
    });
  }

  return nameFromIssue(await pickIssue(!allIssues));
};

export const create = withExamples(
  defineCommand({
    meta: {
      name: 'create',
      description:
        'Create a git worktree from a Jira ticket or a free-form name',
    },
    args: {
      repo: {
        type: 'string',
        description:
          'Repository name from config, or a path to a git repository',
      },
      ticket: {
        type: 'string',
        description:
          'Jira issue key; skip it to pick from your current sprint (use `worktree tickets` to discover keys)',
      },
      'all-issues': {
        type: 'boolean',
        description:
          'When picking a ticket, list every open issue assigned to you, not just the current sprint',
        default: false,
      },
      name: {
        type: 'string',
        description:
          'Free-form name; overrides the Jira summary when --ticket is also given',
      },
      type: {
        type: 'string',
        description: `Worktree type: ${WORKTREE_TYPES.join(' or ')} (default: feature)`,
      },
      base: {
        type: 'string',
        description:
          'Branch to start from (default: the repository development or hotfix branch)',
      },
      'dry-run': {
        type: 'boolean',
        description:
          'Print what would be created without touching the filesystem',
        default: false,
      },
      verbose: {
        type: 'boolean',
        description:
          'Also report the repository, branch and base branch on stderr',
        default: false,
      },
      config: {
        type: 'string',
        description: 'Path to the config file',
      },
    },
    async run({ args }) {
      const { config } = await loadConfig(args.config);
      const repository = await resolveTargetRepository(config, args.repo);
      const type = await resolveType(args.type);
      const name = await resolveName({
        ticket: args.ticket,
        name: args.name,
        allIssues: args['all-issues'],
      });

      const branch = buildBranchName({ type, name: name.branch });
      const base = args.base ?? baseBranchFor(repository, type);
      const worktreePath = join(
        worktreesRoot(config),
        repository.name,
        name.directory
      );

      // stdout carries the path and nothing else, so `cd "$(...)"` works in
      // either mode; --verbose adds a summary alongside it, on stderr.
      const report = (status: string, base: string) => {
        if (args.verbose) {
          writeStderrLine(status);
          writeStderrLine(`repository: ${repository.name}`);
          writeStderrLine(`branch: ${branch}`);
          writeStderrLine(`base: ${base}`);
        }

        writeLine(worktreePath);
      };

      if (args['dry-run']) {
        report('would create worktree', base);
        return;
      }

      if (await pathExists(worktreePath)) {
        report('worktree already exists', base);
        return;
      }

      // Only the start point needs to exist; reusing a branch ignores it.
      if (!(await branchExists(repository.path, branch))) {
        await assertLocalBranch(repository, base);
      }

      await mkdir(dirname(worktreePath), { recursive: true });

      const { reusedBranch } = await addWorktree({
        repositoryPath: repository.path,
        worktreePath,
        branch,
        startPoint: base,
      });

      report(
        reusedBranch
          ? 'created worktree (existing branch)'
          : 'created worktree',
        base
      );
    },
  }),
  [
    'worktree create --repo vela                    # pick a ticket from your current sprint',
    'worktree create --repo vela --ticket ABC-123   # skip the picker',
    'worktree create --repo vela --name "fix login redirect" --verbose',
    'worktree create --repo vela --ticket ABC-123 --type hotfix',
    'cd "$(worktree create --repo vela --ticket ABC-123)"',
    'worktree create --repo ./path/to/repo --name spike --dry-run',
  ]
);
