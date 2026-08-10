import { renderUsage, type CommandDef } from 'citty';

import { examplesFor } from '@/lib/examples.js';
import { writeLine } from '@/utils/write-line.js';

const HELP_FLAGS = new Set(['--help', '-h']);
const VERSION_FLAGS = new Set(['--version', '-v']);

const resolveCommand = (
  command: CommandDef,
  rawArgs: string[]
): [CommandDef, CommandDef | undefined] => {
  let current = command;
  let parent: CommandDef | undefined;

  for (const arg of rawArgs) {
    if (arg.startsWith('-')) {
      break;
    }

    const subCommands = current.subCommands as
      | Record<string, CommandDef>
      | undefined;
    const next = subCommands?.[arg];

    if (!next) {
      break;
    }

    parent = current;
    current = next;
  }

  return [current, parent];
};

const renderExamples = (command: CommandDef) => {
  const examples = examplesFor(command);

  if (!examples || examples.length === 0) {
    return '';
  }

  return [
    '',
    'EXAMPLES',
    '',
    ...examples.map((example) => `  ${example}`),
  ].join('\n');
};

export const handleBuiltinFlags = async ({
  command,
  rawArgs,
  version,
}: {
  command: CommandDef;
  rawArgs: string[];
  version: string;
}) => {
  if (rawArgs.some((arg) => VERSION_FLAGS.has(arg))) {
    writeLine(version);
    return true;
  }

  const wantsHelp =
    rawArgs.length === 0 || rawArgs.some((arg) => HELP_FLAGS.has(arg));

  if (!wantsHelp) {
    return false;
  }

  const [resolved, parent] = resolveCommand(command, rawArgs);

  writeLine(await renderUsage(resolved, parent));
  writeLine(renderExamples(resolved));

  return true;
};
