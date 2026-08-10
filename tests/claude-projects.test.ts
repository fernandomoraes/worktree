import { homedir } from 'node:os';

import { claudeProjectPath, claudeProjectSlug } from '@/lib/claude-projects.js';

describe('claudeProjectSlug', () => {
  it('matches the slug Claude Code derives from an absolute path', () => {
    expect(
      claudeProjectSlug('/Users/fernando/Workspaces/fm/projects/demo')
    ).toBe('-Users-fernando-Workspaces-fm-projects-demo');
  });

  it('replaces every non-alphanumeric character', () => {
    expect(claudeProjectSlug('/tmp/my_repo.v2/feature')).toBe(
      '-tmp-my-repo-v2-feature'
    );
  });
});

describe('claudeProjectPath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves under ~/.claude/projects', () => {
    expect(claudeProjectPath('/tmp/demo')).toBe(
      `${homedir()}/.claude/projects/-tmp-demo`
    );
  });

  it('follows CLAUDE_CONFIG_DIR when Claude Code is relocated', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '/opt/claude-config');

    expect(claudeProjectPath('/tmp/demo')).toBe(
      '/opt/claude-config/projects/-tmp-demo'
    );
  });

  it('expands ~ inside CLAUDE_CONFIG_DIR', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '~/somewhere/claude');

    expect(claudeProjectPath('/tmp/demo')).toBe(
      `${homedir()}/somewhere/claude/projects/-tmp-demo`
    );
  });

  it('falls back to the default when CLAUDE_CONFIG_DIR is empty', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');

    expect(claudeProjectPath('/tmp/demo')).toBe(
      `${homedir()}/.claude/projects/-tmp-demo`
    );
  });
});
