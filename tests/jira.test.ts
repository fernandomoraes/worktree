import { fetchIssue, resolveJiraCredentials } from '@/lib/jira.js';

const respondWith = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  );

beforeEach(() => {
  vi.stubEnv('ATLASSIAN_URL', 'https://acme.atlassian.net/');
  vi.stubEnv('ATLASSIAN_EMAIL', 'you@acme.io');
  vi.stubEnv('ATLASSIAN_API_TOKEN', 'token');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('resolveJiraCredentials', () => {
  it('reads the environment and strips the trailing slash', () => {
    expect(resolveJiraCredentials()).toEqual({
      baseUrl: 'https://acme.atlassian.net',
      user: 'you@acme.io',
      token: 'token',
    });
  });

  it('names the missing site URL and how to set it', () => {
    vi.stubEnv('ATLASSIAN_URL', '');

    expect(() => resolveJiraCredentials()).toThrow(/Set ATLASSIAN_URL=/);
  });

  it('names the missing email', () => {
    vi.stubEnv('ATLASSIAN_EMAIL', '');

    expect(() => resolveJiraCredentials()).toThrow(/Set ATLASSIAN_EMAIL=/);
  });

  it('names the missing token and where to create one', () => {
    vi.stubEnv('ATLASSIAN_API_TOKEN', '');

    expect(() => resolveJiraCredentials()).toThrow(
      /Set ATLASSIAN_API_TOKEN=.*id\.atlassian\.com/s
    );
  });
});

describe('fetchIssue', () => {
  it('requests the issue with basic auth and returns its summary', async () => {
    const mock = respondWith(200, {
      key: 'ABC-123',
      fields: { summary: 'Fix login redirect', issuetype: { name: 'Bug' } },
    });

    const issue = await fetchIssue('ABC-123');

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

    await expect(fetchIssue('ABC-123')).rejects.toThrow(
      /authentication failed/i
    );
  });

  it('maps 404 to a message pointing at --name', async () => {
    respondWith(404, {});

    await expect(fetchIssue('ABC-123')).rejects.toThrow(/not found.*--name/is);
  });

  it('surfaces the status and body for unmapped errors', async () => {
    respondWith(500, { message: 'boom' });

    await expect(fetchIssue('ABC-123')).rejects.toThrow(/HTTP 500/);
  });
});
