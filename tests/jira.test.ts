import { fetchIssue, resolveJiraCredentials } from '@/lib/jira.js';

import type { Config } from '@/lib/config.js';

const config: Config = {
  worktreesPath: '~/worktrees',
  repositories: [],
  jira: { baseUrl: 'https://acme.atlassian.net/', user: 'you@acme.io' },
};

const emptyJiraConfig: Config = { ...config, jira: {} };

const respondWith = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  );

beforeEach(() => {
  vi.stubEnv('JIRA_API_TOKEN', 'token');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('resolveJiraCredentials', () => {
  it('reads from config and strips the trailing slash', () => {
    expect(resolveJiraCredentials(config)).toEqual({
      baseUrl: 'https://acme.atlassian.net',
      user: 'you@acme.io',
      token: 'token',
    });
  });

  it('lets environment variables win over config', () => {
    vi.stubEnv('JIRA_BASE_URL', 'https://other.atlassian.net');
    vi.stubEnv('JIRA_USER', 'other@acme.io');

    expect(resolveJiraCredentials(config)).toMatchObject({
      baseUrl: 'https://other.atlassian.net',
      user: 'other@acme.io',
    });
  });

  it('names the missing base URL and how to set it', () => {
    expect(() => resolveJiraCredentials(emptyJiraConfig)).toThrow(
      /JIRA_BASE_URL/
    );
  });

  it('names the missing token', () => {
    vi.stubEnv('JIRA_API_TOKEN', '');

    expect(() => resolveJiraCredentials(config)).toThrow(/JIRA_API_TOKEN/);
  });
});

describe('fetchIssue', () => {
  it('requests the issue with basic auth and returns its summary', async () => {
    const mock = respondWith(200, {
      key: 'ABC-123',
      fields: { summary: 'Fix login redirect', issuetype: { name: 'Bug' } },
    });

    const issue = await fetchIssue(config, 'ABC-123');

    expect(issue).toEqual({
      key: 'ABC-123',
      summary: 'Fix login redirect',
      type: 'Bug',
    });

    const [url, init] = mock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://acme.atlassian.net/rest/api/3/issue/ABC-123?fields=summary,issuetype'
    );
    expect(init?.headers).toMatchObject({
      authorization: `Basic ${Buffer.from('you@acme.io:token').toString('base64')}`,
    });
  });

  it('maps 401 to an authentication message', async () => {
    respondWith(401, {});

    await expect(fetchIssue(config, 'ABC-123')).rejects.toThrow(
      /authentication failed/i
    );
  });

  it('maps 404 to a message pointing at --name', async () => {
    respondWith(404, {});

    await expect(fetchIssue(config, 'ABC-123')).rejects.toThrow(
      /not found.*--name/is
    );
  });

  it('surfaces the status and body for unmapped errors', async () => {
    respondWith(500, { message: 'boom' });

    await expect(fetchIssue(config, 'ABC-123')).rejects.toThrow(/HTTP 500/);
  });
});
