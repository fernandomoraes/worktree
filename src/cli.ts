#!/usr/bin/env node
import { defineCommand, runCommand } from 'citty';

import { clean } from '@/commands/clean.js';
import { config } from '@/commands/config.js';
import { create } from '@/commands/create.js';
import { list } from '@/commands/list.js';
import { pick } from '@/commands/pick.js';
import { tickets } from '@/commands/tickets.js';
import { handleBuiltinFlags } from '@/lib/help.js';
import { CancelledError } from '@/utils/cancelled-error.js';
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

// `worktree list | head` closes stdout early; that surfaces as an unhandled
// EPIPE and a stack trace unless it is swallowed.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') {
    process.exit(0);
  }

  throw error;
});

const run = async () => {
  const rawArgs = process.argv.slice(2);

  if (await handleBuiltinFlags({ command: main, rawArgs, version })) {
    return;
  }

  await runCommand(main, { rawArgs });
};

run().catch((error: unknown) => {
  // Escaping a prompt is not a failure: the prompt already reported it.
  if (error instanceof CancelledError) {
    process.exit(130);
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
