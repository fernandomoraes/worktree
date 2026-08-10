import { rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { expandHome } from '@/utils/expand-home.js';

const NON_ALPHANUMERIC = /[^a-zA-Z0-9]/g;

/** Claude Code reads CLAUDE_CONFIG_DIR to relocate the default ~/.claude root. */
const claudeConfigDirectory = () =>
  process.env.CLAUDE_CONFIG_DIR
    ? expandHome(process.env.CLAUDE_CONFIG_DIR)
    : join(homedir(), '.claude');

export const claudeProjectSlug = (worktreePath: string) =>
  resolve(worktreePath).replaceAll(NON_ALPHANUMERIC, '-');

export const claudeProjectPath = (worktreePath: string) =>
  join(claudeConfigDirectory(), 'projects', claudeProjectSlug(worktreePath));

export const claudeProjectExists = async (worktreePath: string) => {
  try {
    const stats = await stat(claudeProjectPath(worktreePath));
    return stats.isDirectory();
  } catch {
    return false;
  }
};

export const removeClaudeProject = async (worktreePath: string) => {
  const path = claudeProjectPath(worktreePath);

  if (!(await claudeProjectExists(worktreePath))) {
    return { path, removed: false };
  }

  await rm(path, { recursive: true, force: true });

  return { path, removed: true };
};
