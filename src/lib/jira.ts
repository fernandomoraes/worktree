export class JiraError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'JiraError';
    this.status = status;
  }
}

export type JiraIssue = {
  key: string;
  summary: string;
  type: string;
};

type JiraCredentials = {
  baseUrl: string;
  user: string;
  token: string;
};

const TRAILING_SLASHES = /\/+$/;

const missingCredential = (name: string, envVar: string, hint: string) =>
  new Error(`Missing Atlassian ${name}.\n  Set ${envVar}=${hint}`);

export const resolveJiraCredentials = (): JiraCredentials => {
  const baseUrl = process.env.ATLASSIAN_URL;
  const user = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;

  if (!baseUrl) {
    throw missingCredential(
      'site URL',
      'ATLASSIAN_URL',
      'https://your-org.atlassian.net'
    );
  }

  if (!user) {
    throw missingCredential('email', 'ATLASSIAN_EMAIL', 'you@example.com');
  }

  if (!token) {
    throw missingCredential(
      'API token',
      'ATLASSIAN_API_TOKEN',
      'a token from https://id.atlassian.com/manage-profile/security/api-tokens'
    );
  }

  return { baseUrl: baseUrl.replace(TRAILING_SLASHES, ''), user, token };
};

const buildError = async (response: Response, issueKey: string) => {
  const body = await response.text().catch(() => '');

  if (response.status === 401) {
    return new JiraError(
      'Jira authentication failed. Check ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN.',
      401
    );
  }

  if (response.status === 403) {
    return new JiraError(
      `Access denied for issue ${issueKey}. Your Jira account may lack permission to view it.`,
      403
    );
  }

  if (response.status === 404) {
    return new JiraError(
      `Issue ${issueKey} not found. Check the key, or pass --name to skip Jira.`,
      404
    );
  }

  return new JiraError(
    `Jira API error (HTTP ${response.status}): ${body}`,
    response.status
  );
};

type IssueResponse = {
  key: string;
  fields: { summary?: string; issuetype?: { name?: string } };
};

export const fetchIssue = async (issueKey: string): Promise<JiraIssue> => {
  const { baseUrl, user, token } = resolveJiraCredentials();
  const authorization = Buffer.from(`${user}:${token}`).toString('base64');

  const response = await fetch(
    `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,issuetype`,
    {
      headers: {
        authorization: `Basic ${authorization}`,
        accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw await buildError(response, issueKey);
  }

  const issue = (await response.json()) as IssueResponse;

  return {
    key: issue.key,
    summary: issue.fields.summary ?? '',
    type: issue.fields.issuetype?.name ?? 'unknown',
  };
};
