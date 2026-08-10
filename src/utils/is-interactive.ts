/**
 * Prompts render to stderr, so stdout may be redirected — as in
 * `cd "$(worktree list --pick)"` — while the session is still interactive.
 */
export const isInteractive = () =>
  Boolean(process.stdin.isTTY) && Boolean(process.stderr.isTTY);
