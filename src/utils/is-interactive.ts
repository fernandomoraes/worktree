export const isInteractive = () =>
  Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
