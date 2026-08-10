const writeError = (line: string) => {
  process.stderr.write(`${line}\n`);
};

export const logger = {
  error: (message: string) => writeError(`Error: ${message}`),
  warn: (message: string) => writeError(`Warning: ${message}`),
  debug: (message: string) => {
    if (process.env.WORKTREE_DEBUG) {
      writeError(`Debug: ${message}`);
    }
  },
};
