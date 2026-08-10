import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConfig, resolveConfigPath } from '@/lib/config.js';

const writeConfig = async (contents: unknown) => {
  const directory = await mkdtemp(join(tmpdir(), 'worktree-config-'));
  const path = join(directory, 'config.json');
  await writeFile(
    path,
    typeof contents === 'string' ? contents : JSON.stringify(contents)
  );
  return path;
};

describe('resolveConfigPath', () => {
  it('prefers the explicit path', () => {
    expect(resolveConfigPath('/tmp/custom.json')).toBe('/tmp/custom.json');
  });

  it('falls back to XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg');
    expect(resolveConfigPath()).toBe('/tmp/xdg/worktree/config.json');
    vi.unstubAllEnvs();
  });
});

describe('loadConfig', () => {
  it('applies defaults for omitted fields', async () => {
    const path = await writeConfig({
      repositories: [{ name: 'demo', path: '/tmp/demo' }],
    });

    const { config, exists } = await loadConfig(path);

    expect(exists).toBe(true);
    expect(config.worktreesPath).toBe('~/worktrees');
    expect(config.repositories[0]?.developmentBranch).toBe('main');
    expect(config.repositories[0]?.hotfixBranch).toBeUndefined();
  });

  it('returns defaults when no config file exists at the default location', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', join(tmpdir(), 'worktree-missing-config'));

    const { config, exists } = await loadConfig();

    expect(exists).toBe(false);
    expect(config.repositories).toEqual([]);
    vi.unstubAllEnvs();
  });

  it('fails loudly when an explicitly requested config is missing', async () => {
    await expect(loadConfig('/tmp/definitely-not-here.json')).rejects.toThrow(
      /Config file not found/
    );
  });

  it('reports the offending field on invalid input', async () => {
    const path = await writeConfig({ repositories: [{ name: 'demo' }] });

    await expect(loadConfig(path)).rejects.toThrow(/repositories\.0\.path/);
  });

  it('reports invalid JSON with the file path', async () => {
    const path = await writeConfig('{ not json');

    await expect(loadConfig(path)).rejects.toThrow(/Invalid JSON/);
  });
});
