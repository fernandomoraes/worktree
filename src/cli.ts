#!/usr/bin/env node
import { defineCommand, runCommand } from 'citty';

import { clean } from '@/commands/clean.js';
import { config } from '@/commands/config.js';
import { create } from '@/commands/create.js';
import { list } from '@/commands/list.js';
import { pick } from '@/commands/pick.js';
import { tickets } from '@/commands/tickets.js';
import { handleBuiltinFlags } from '@/lib/help.js';
import { logger } from '@/utils/logger.js';
import { version } from '@/version.js';

const main = defineCommand({
  meta: {
    name: 'worktree',
    version,
    description: 'Manage git worktrees for tickets and hotfixes',
  },
  subCommands: { list, pick, create, clean, tickets, config },
});

const run = async () => {
  const rawArgs = process.argv.slice(2);

  if (await handleBuiltinFlags({ command: main, rawArgs, version })) {
    return;
  }

  await runCommand(main, { rawArgs });
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
