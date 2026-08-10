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
  it('resolves under ~/.claude/projects', () => {
    expect(claudeProjectPath('/tmp/demo')).toBe(
      `${homedir()}/.claude/projects/-tmp-demo`
    );
  });
});
