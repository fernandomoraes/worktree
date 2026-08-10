import type { Config } from '@/lib/config.js';

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

const missingCredential = (name: string, envVar: string, configPath: string) =>
  new Error(
    `Missing Jira ${name}.\n  Set ${envVar} or add "${configPath}" to your config file.\n  See: worktree config show`
  );

export const resolveJiraCredentials = (config: Config): JiraCredentials => {
  const baseUrl = process.env.JIRA_BASE_URL ?? config.jira.baseUrl;
  const user = process.env.JIRA_USER ?? config.jira.user;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl) {
    throw missingCredential('base URL', 'JIRA_BASE_URL', 'jira.baseUrl');
  }

  if (!user) {
    throw missingCredential('user', 'JIRA_USER', 'jira.user');
  }

  if (!token) {
    throw new Error(
      'Missing Jira API token.\n  Set JIRA_API_TOKEN with a token from https://id.atlassian.com/manage-profile/security/api-tokens'
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), user, token };
};

const buildError = async (response: Response, issueKey: string) => {
  const body = await response.text().catch(() => '');

  if (response.status === 401) {
    return new JiraError(
      'Jira authentication failed. Check JIRA_USER and JIRA_API_TOKEN.',
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

export const fetchIssue = async (
  config: Config,
  issueKey: string
): Promise<JiraIssue> => {
  const { baseUrl, user, token } = resolveJiraCredentials(config);
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
