import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  select,
  text,
} from '@clack/prompts';

import { WORKTREE_TYPES, type WorktreeType } from '@/lib/branch-name.js';

import type { Config } from '@/lib/config.js';
import type { JiraIssue } from '@/lib/jira.js';

const unwrap = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel('Cancelled.');
    throw new Error('Cancelled by user.');
  }

  return value as T;
};

export const promptRepository = async (config: Config) =>
  unwrap(
    await select({
      message: 'Repository',
      options: config.repositories.map((repository) => ({
        value: repository.name,
        label: repository.name,
        hint: repository.path,
      })),
    })
  );

export const promptType = async () =>
  unwrap(
    await select<WorktreeType>({
      message: 'Type',
      options: WORKTREE_TYPES.map((type) => ({ value: type, label: type })),
    })
  );

export const NAME_SOURCES = ['ticket', 'free-form'] as const;

export type NameSource = (typeof NAME_SOURCES)[number];

export const promptNameSource = async () =>
  unwrap(
    await select<NameSource>({
      message: 'How should this worktree be named?',
      options: [
        {
          value: 'ticket',
          label: 'From a Jira ticket',
          hint: 'pick from your current sprint',
        },
        { value: 'free-form', label: 'Free form', hint: 'type a name' },
      ],
    })
  );

export const promptIssue = async (issues: JiraIssue[]) =>
  unwrap(
    await select({
      message: 'Ticket',
      options: issues.map((issue) => ({
        value: issue.key,
        label: `${issue.key}  ${issue.summary}`,
        hint: `${issue.type} · ${issue.status}`,
      })),
    })
  );

export const promptText = async (message: string) =>
  unwrap(
    await text({
      message,
      validate: (value) => (value?.trim() ? undefined : 'Required.'),
    })
  );

export const promptConfirm = async (message: string) =>
  unwrap(await confirm({ message, initialValue: false }));

export type SelectionOption = {
  value: string;
  label: string;
  hint?: string;
};

export const promptSelection = async (
  message: string,
  options: SelectionOption[]
) => unwrap(await multiselect({ message, options, required: false }));
