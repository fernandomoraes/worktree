import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { defineCommand } from 'citty';

import { loadConfig, resolveConfigPath, worktreesRoot } from '@/lib/config.js';
import { withExamples } from '@/lib/examples.js';
import { writeLine } from '@/utils/write-line.js';

const TEMPLATE = {
  worktreesPath: '~/worktrees',
  repositories: [
    {
      name: 'example',
      path: '~/Workspaces/example',
      developmentBranch: 'main',
      hotfixBranch: 'production',
    },
  ],
};

const path = defineCommand({
  meta: {
    name: 'path',
    description: 'Print the config file path that would be used',
  },
  args: {
    config: { type: 'string', description: 'Path to the config file' },
  },
  run({ args }) {
    writeLine(resolveConfigPath(args.config));
  },
});

const show = defineCommand({
  meta: {
    name: 'show',
    description: 'Print the resolved configuration',
  },
  args: {
    config: { type: 'string', description: 'Path to the config file' },
    json: {
      type: 'boolean',
      description: 'Emit the resolved config as JSON',
      default: false,
    },
  },
  async run({ args }) {
    const loaded = await loadConfig(args.config);

    if (args.json) {
      writeLine(JSON.stringify(loaded.config, undefined, 2));
      return;
    }

    writeLine(`config_path: ${loaded.path}`);
    writeLine(`config_exists: ${loaded.exists}`);
    writeLine(`worktrees_path: ${worktreesRoot(loaded.config)}`);
    writeLine(`atlassian_url: ${process.env.ATLASSIAN_URL ?? '(unset)'}`);
    writeLine(`atlassian_email: ${process.env.ATLASSIAN_EMAIL ?? '(unset)'}`);
    writeLine(
      `atlassian_api_token: ${process.env.ATLASSIAN_API_TOKEN ? '(set)' : '(unset)'}`
    );
    writeLine(`repositories: ${loaded.config.repositories.length}`);

    for (const repository of loaded.config.repositories) {
      writeLine(
        [
          repository.name,
          repository.path,
          repository.developmentBranch,
          repository.hotfixBranch ?? '-',
        ].join('\t')
      );
    }
  },
});

const init = defineCommand({
  meta: {
    name: 'init',
    description: 'Write a starter config file',
  },
  args: {
    config: { type: 'string', description: 'Path to the config file' },
    force: {
      type: 'boolean',
      description: 'Overwrite an existing config file',
      default: false,
    },
  },
  async run({ args }) {
    const target = resolveConfigPath(args.config);
    const existing = await loadConfig(args.config).catch(() => undefined);

    if (existing?.exists && !args.force) {
      writeLine('config already exists');
      writeLine(`config_path: ${target}`);
      return;
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(TEMPLATE, undefined, 2)}\n`);

    writeLine('created config');
    writeLine(`config_path: ${target}`);
  },
});

export const config = withExamples(
  defineCommand({
    meta: {
      name: 'config',
      description: 'Inspect and scaffold the config file',
    },
    subCommands: { path, show, init },
  }),
  [
    'worktree config path',
    'worktree config show',
    'worktree config show --json',
    'worktree config init',
  ]
);
