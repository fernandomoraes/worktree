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
