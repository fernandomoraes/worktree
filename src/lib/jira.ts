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
  status: string;
};

type JiraCredentials = {
  baseUrl: string;
  user: string;
  token: string;
};

const TRAILING_SLASHES = /\/+$/;

const ISSUE_FIELDS = 'summary,issuetype,status';

const ASSIGNED_TO_ME = 'assignee = currentUser() AND resolution = Unresolved';
const CURRENT_SPRINT = 'sprint in openSprints()';
const NEWEST_FIRST = 'ORDER BY updated DESC';

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

const buildError = async (
  response: Response,
  resource: string,
  notFoundHint?: string
) => {
  const body = await response.text().catch(() => '');

  if (response.status === 401) {
    return new JiraError(
      'Jira authentication failed. Check ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN.',
      401
    );
  }

  if (response.status === 403) {
    return new JiraError(
      `Access denied for ${resource}. Your Jira account may lack permission to view it.`,
      403
    );
  }

  if (response.status === 404) {
    return new JiraError(
      [`${resource} not found.`, notFoundHint].filter(Boolean).join('\n  '),
      404
    );
  }

  return new JiraError(
    `Jira API error (HTTP ${response.status}) for ${resource}: ${body}`,
    response.status
  );
};

const request = async (
  path: string,
  resource: string,
  notFoundHint?: string
) => {
  const { baseUrl, user, token } = resolveJiraCredentials();
  const authorization = Buffer.from(`${user}:${token}`).toString('base64');

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      authorization: `Basic ${authorization}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw await buildError(response, resource, notFoundHint);
  }

  return response.json() as Promise<unknown>;
};

type IssueResponse = {
  key: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string };
    status?: { name?: string };
  };
};

const toIssue = (issue: IssueResponse): JiraIssue => ({
  key: issue.key,
  summary: issue.fields.summary ?? '',
  type: issue.fields.issuetype?.name ?? 'unknown',
  status: issue.fields.status?.name ?? 'unknown',
});

export const fetchIssue = async (issueKey: string): Promise<JiraIssue> => {
  const path = `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${ISSUE_FIELDS}`;
  const response = await request(
    path,
    `Issue ${issueKey}`,
    'Check the key, or pass --name to skip Jira.'
  );

  return toIssue(response as IssueResponse);
};

const search = async (jql: string, limit: number) => {
  const query = new URLSearchParams({
    jql,
    fields: ISSUE_FIELDS,
    maxResults: String(limit),
  });

  const response = (await request(
    `/rest/api/3/search/jql?${query}`,
    'issue search'
  )) as { issues?: IssueResponse[] };

  return (response.issues ?? []).map(toIssue);
};

const MISSING_SPRINT_FIELD = /field 'sprint' does not exist/i;

export const fetchAssignedIssues = async ({
  currentSprintOnly,
  limit = 50,
}: {
  currentSprintOnly: boolean;
  limit?: number;
}) => {
  const jql = currentSprintOnly
    ? `${ASSIGNED_TO_ME} AND ${CURRENT_SPRINT} ${NEWEST_FIRST}`
    : `${ASSIGNED_TO_ME} ${NEWEST_FIRST}`;

  try {
    return await search(jql, limit);
  } catch (error) {
    if (
      currentSprintOnly &&
      error instanceof JiraError &&
      MISSING_SPRINT_FIELD.test(error.message)
    ) {
      throw new JiraError(
        'Your Jira projects have no sprint field, so there is no current sprint to read.\n  Re-run with --all-issues to list every open issue assigned to you.',
        error.status
      );
    }

    throw error;
  }
};
