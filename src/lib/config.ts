import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

import { expandHome } from '@/utils/expand-home.js';

const repositorySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  developmentBranch: z.string().min(1).default('main'),
  hotfixBranch: z.string().min(1).optional(),
});

const jiraSchema = z.object({
  baseUrl: z.url().optional(),
  user: z.email().optional(),
});

const configSchema = z.object({
  worktreesPath: z.string().min(1).default('~/worktrees'),
  repositories: z.array(repositorySchema).default([]),
  jira: jiraSchema.default({}),
});

export type RepositoryConfig = z.infer<typeof repositorySchema>;
export type Config = z.infer<typeof configSchema>;

export type LoadedConfig = {
  config: Config;
  path: string;
  exists: boolean;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const defaultConfigPath = () =>
  join(
    process.env.XDG_CONFIG_HOME
      ? expandHome(process.env.XDG_CONFIG_HOME)
      : join(homedir(), '.config'),
    'worktree',
    'config.json'
  );

export const resolveConfigPath = (explicitPath?: string) => {
  if (explicitPath) {
    return expandHome(explicitPath);
  }

  if (process.env.WORKTREE_CONFIG) {
    return expandHome(process.env.WORKTREE_CONFIG);
  }

  return defaultConfigPath();
};

const parseConfig = (raw: string, path: string) => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Invalid JSON in ${path}: ${message}`);
  }

  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Invalid config at ${path}:\n${issues}`);
  }

  return result.data;
};

export const loadConfig = async (
  explicitPath?: string
): Promise<LoadedConfig> => {
  const path = resolveConfigPath(explicitPath);

  let raw: string;

  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    const isMissing =
      error instanceof Error && 'code' in error && error.code === 'ENOENT';

    if (isMissing && !explicitPath && !process.env.WORKTREE_CONFIG) {
      return { config: configSchema.parse({}), path, exists: false };
    }

    if (isMissing) {
      throw new ConfigError(
        `Config file not found: ${path}\n  Create one with: worktree config init --config ${path}`
      );
    }

    throw error;
  }

  return { config: parseConfig(raw, path), path, exists: true };
};

export const worktreesRoot = (config: Config) =>
  expandHome(config.worktreesPath);

export const findRepository = (config: Config, name: string) =>
  config.repositories.find((repository) => repository.name === name);
