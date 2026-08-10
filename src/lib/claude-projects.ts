import { rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const NON_ALPHANUMERIC = /[^a-zA-Z0-9]/g;

export const claudeProjectSlug = (worktreePath: string) =>
  resolve(worktreePath).replaceAll(NON_ALPHANUMERIC, '-');

export const claudeProjectPath = (worktreePath: string) =>
  join(homedir(), '.claude', 'projects', claudeProjectSlug(worktreePath));

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
