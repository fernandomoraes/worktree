import {
  assertWorktreeType,
  buildBranchName,
  buildWorktreeName,
} from '@/lib/branch-name.js';

describe('buildWorktreeName', () => {
  it('combines an uppercased ticket key with a slugified description', () => {
    expect(
      buildWorktreeName({
        ticket: 'abc-123',
        description: 'Fix Login Redirect',
      }).branch
    ).toBe('ABC-123-fix-login-redirect');
  });

  it('keeps the directory down to the ticket key', () => {
    expect(
      buildWorktreeName({
        ticket: 'abc-123',
        description: 'Fix the login redirect when the session has expired',
      }).directory
    ).toBe('ABC-123');
  });

  it('strips accents and punctuation from the description', () => {
    expect(
      buildWorktreeName({ description: 'Corrigir integração (v2)!' }).branch
    ).toBe('corrigir-integracao-v2');
  });

  it('works without a ticket', () => {
    expect(buildWorktreeName({ description: 'spike' })).toEqual({
      branch: 'spike',
      directory: 'spike',
    });
  });

  it('works without a description', () => {
    expect(buildWorktreeName({ ticket: 'ABC-1' })).toEqual({
      branch: 'ABC-1',
      directory: 'ABC-1',
    });
  });

  it('throws when nothing usable is provided', () => {
    expect(() => buildWorktreeName({ description: '---' })).toThrow(
      /Cannot derive a worktree name/
    );
  });
});

describe('buildBranchName', () => {
  it('prefixes the branch with the worktree type', () => {
    expect(buildBranchName({ type: 'feature', name: 'ABC-1-thing' })).toBe(
      'feature/ABC-1-thing'
    );
    expect(buildBranchName({ type: 'hotfix', name: 'ABC-1-thing' })).toBe(
      'hotfix/ABC-1-thing'
    );
  });
});

describe('assertWorktreeType', () => {
  it('accepts known types', () => {
    expect(assertWorktreeType('feature')).toBe('feature');
    expect(assertWorktreeType('hotfix')).toBe('hotfix');
  });

  it('rejects unknown types with the valid values', () => {
    expect(() => assertWorktreeType('release')).toThrow(
      /Expected one of: feature, hotfix/
    );
  });
});
