import { homedir } from 'node:os';
import { resolve } from 'node:path';

export const expandHome = (path: string) => {
  if (path === '~') {
    return homedir();
  }

  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2));
  }

  return resolve(path);
};
