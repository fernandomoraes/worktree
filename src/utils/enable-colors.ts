/**
 * Colour libraries decide whether to emit ANSI codes by looking at stdout, even
 * for output written to stderr. `cd "$(worktree pick)"` captures stdout, which
 * silently stripped the colour out of prompts that render on stderr.
 *
 * When stdout is captured but stderr is still a terminal, opt colour back in.
 * NO_COLOR and an explicit FORCE_COLOR both win over this.
 */
export const enableColors = () => {
  if (process.env.NO_COLOR || process.env.FORCE_COLOR) {
    return;
  }

  if (process.stderr.isTTY && !process.stdout.isTTY) {
    process.env.FORCE_COLOR = '1';
  }
};
