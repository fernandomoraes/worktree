# @moraes/worktree

A CLI for the git worktree loop: create one per ticket or hotfix, list what you have open, and
clean them up — including the `~/.claude/projects` directory that Claude Code leaves behind for
each worktree path.

```bash
npm install -g @moraes/worktree
```

Requires **Node.js >= 22** and **git** on `PATH`.

## Quick start

```bash
worktree config init                          # scaffold ~/.config/worktree/config.json
worktree create --repo vela                   # pick a ticket from your current sprint
cd "$(worktree create --repo vela)"           # ...and jump straight into it
worktree tickets                              # your sprint tickets, for scripts
worktree list                                 # see what is open
cd "$(worktree pick)"                         # pick an existing one and jump into it
worktree clean --repo vela --branch feature/ABC-123-fix-login-redirect
```

## Design

The CLI is built for humans and agents at the same time:

- **Flags are the interface.** Every command runs unattended. Interactive prompts only fill in
  a missing flag when a TTY is attached; in a pipe or CI the same input is an actionable error,
  never a hanging prompt.
- **stdout is only ever worktree paths.** Summaries, prompts and errors all go to stderr, in
  every mode, so `cd "$(worktree create ...)"` always works. `--verbose` adds detail beside
  the data; it never replaces it.
- **Interactivity is a command, not a mode.** `list` always prints rows; `pick` always opens a
  picker and refuses to run without a terminal. Neither changes shape based on what stdout
  happens to be attached to.
- **Idempotent.** Re-running `create` reports the existing worktree instead of failing;
  `clean` on an already-clean repo is a no-op.
- **Safe by default.** Destructive commands support `--dry-run`, prompt before acting, and
  refuse to discard uncommitted work unless you pass `--force`.
- **Exit code 0 on success, 1 on failure**, with the reason on stderr and a suggested fix.

## Commands

Run `worktree <command> --help` for the full flag list and examples.

### `worktree list`

Prints worktrees across every configured repository as `repository<TAB>branch<TAB>path`. Always
non-interactive, so it composes with pipes and scripts.

| Flag              | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `--repo <ref>`    | Limit to one repository: a config name or a path to a git repo    |
| `--all`           | Include each repository's primary worktree (excluded by default)  |
| `--json`          | Emit JSON, including `head`, `locked`, and `claudeProject` status |
| `--config <path>` | Use a specific config file                                        |

### `worktree pick`

Opens a multi-select of your worktrees. What you can do next depends on how many you chose:

- **exactly one** → _Open_ (prints its path) or _Delete_
- **more than one** → _Delete_ only

The prompts render on **stderr** and the opened path is the only thing on **stdout**, so the
selection can be captured directly:

```bash
cd "$(worktree pick)"
```

Worth putting in your shell profile:

```bash
wt() { cd "$(worktree pick)" || return; }
```

| Flag                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `--repo <ref>`          | Limit to one repository                            |
| `--delete-branch`       | When deleting, also delete the local branch        |
| `--keep-claude-project` | When deleting, keep the `~/.claude/projects` entry |
| `--force`               | When deleting, allow uncommitted changes           |
| `--yes`                 | Skip the delete confirmation                       |
| `--config <path>`       | Use a specific config file                         |

Deleting writes its progress to stderr, leaving stdout empty — so the `cd` above fails
harmlessly instead of jumping somewhere unexpected. `pick` requires a terminal and errors out
otherwise, pointing you at `worktree list`.

### `worktree create`

Creates a worktree at `<worktreesPath>/<repository>/<name>` on a new branch.

| Flag              | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `--repo <ref>`    | Repository name from config, or a path to a git repository               |
| `--ticket <key>`  | Jira issue key; omit it to pick from your current sprint                 |
| `--all-issues`    | Widen the picker to every open issue assigned to you                     |
| `--name <text>`   | Free-form name; overrides the Jira summary when combined with `--ticket` |
| `--type <type>`   | `feature` (default) or `hotfix` — selects the base branch                |
| `--base <branch>` | Start from an explicit branch instead of the configured one              |
| `--no-fetch`      | Skip fetching the base branch from `origin`                              |
| `--dry-run`       | Print what would be created without touching the filesystem              |
| `--verbose`       | Also report repository, branch and base on stderr                        |
| `--config <path>` | Use a specific config file                                               |

Run it with no naming flags and it asks how to name the worktree:

```
$ worktree create --repo vela
◇  How should this worktree be named?
│  From a Jira ticket   (pick from your current sprint)
│  Free form            (type a name)
│
◇  Ticket
│  ABC-12  Fix login redirect loop      Bug · In Progress
│  ABC-15  Add rate limiting to the API Story · To Do
```

The ticket list is the issues **assigned to you in the current sprint**
(`assignee = currentUser() AND resolution = Unresolved AND sprint in openSprints()`). Add
`--all-issues` to widen it to every open issue assigned to you, regardless of sprint.

`--type feature` branches from the repository's `developmentBranch`; `--type hotfix` branches
from its `hotfixBranch`. The base branch is fetched from `origin` first unless `--no-fetch` is
set, so new worktrees start from the current remote state.

It prints the created path on stdout, so it composes with `cd`:

```bash
$ worktree create --repo vela --ticket ABC-123
/Users/you/worktrees/vela/ABC-123-fix-login-redirect

$ cd "$(worktree create --repo vela --ticket ABC-123)"
```

`--verbose` adds a summary on stderr. The path is still the only thing on stdout, so the `cd`
form keeps working:

```
$ worktree create --repo vela --ticket ABC-123 --verbose
created worktree                                        <- stderr
repository: vela                                        <- stderr
branch: feature/ABC-123-fix-login-redirect              <- stderr
base: origin/main                                       <- stderr
/Users/you/worktrees/vela/ABC-123-fix-login-redirect    <- stdout
```

If the branch already exists locally, it is reused rather than recreated. Re-running the same
command prints the existing path rather than failing, so the `cd` form stays idempotent.

### `worktree clean`

Removes worktrees and, unless told otherwise, their Claude Code project directories.

| Flag                    | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `--repo <ref>`          | Repository name from config, or a path to a git repo  |
| `--branch <branch>`     | Branch of the worktree to remove                      |
| `--all`                 | Remove every non-primary worktree in scope            |
| `--delete-branch`       | Also delete the local branch afterwards               |
| `--keep-claude-project` | Keep the `~/.claude/projects` directory               |
| `--force`               | Remove even with uncommitted changes                  |
| `--yes`                 | Skip the confirmation prompt                          |
| `--dry-run`             | Print what would be removed without removing anything |
| `--verbose`             | Also report each removed worktree on stderr           |
| `--config <path>`       | Use a specific config file                            |

Like `create`, stdout is just the removed paths:

```
$ worktree clean --repo vela --all --yes
/Users/you/worktrees/vela/ABC-123-fix-login-redirect
/Users/you/worktrees/vela/ABC-130-patch
```

`--verbose` adds the detail on stderr:

```
$ worktree clean --repo vela --branch feature/ABC-123-fix-login-redirect --yes --verbose
removed worktree                                        <- stderr
repository: vela                                        <- stderr
branch: feature/ABC-123-fix-login-redirect              <- stderr
claude_project: /Users/you/.claude/projects/-Users-...  <- stderr
/Users/you/worktrees/vela/ABC-123-fix-login-redirect    <- stdout
removed: 1                                              <- stderr
```

`claude_project` reports the removed path, `none` if there was nothing to remove, or `kept`
when `--keep-claude-project` is set.

With no `--branch` and no `--all`, an interactive terminal gets a multi-select of open
worktrees; a non-interactive one gets an error telling you which flag to pass.

### `worktree tickets`

Lists the Jira issues assigned to you in the current sprint as `key<TAB>status<TAB>summary`.
This is the non-interactive counterpart to the picker, so scripts and agents can discover keys
to feed to `--ticket`.

| Flag           | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `--all-issues` | Every open issue assigned to you, not just the current sprint |
| `--limit <n>`  | Maximum issues to return (default: 50)                        |
| `--json`       | Emit JSON with `key`, `summary`, `type`, and `status`         |

```
$ worktree tickets
ABC-12	In Progress	Fix login redirect loop
ABC-15	To Do	Add rate limiting to the API
```

### `worktree config`

| Subcommand             | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `worktree config path` | Print the config file path that would be used   |
| `worktree config show` | Print the resolved configuration (`--json` too) |
| `worktree config init` | Write a starter config (`--force` to overwrite) |

## Configuration

The config file is **optional**. Its location is resolved in this order:

1. `--config <path>`
2. `$WORKTREE_CONFIG`
3. `$XDG_CONFIG_HOME/worktree/config.json` (defaults to `~/.config/worktree/config.json`)

A missing file at the default location is fine — the CLI falls back to defaults. A missing file
at a path you asked for explicitly is an error, so typos never pass silently.

```json
{
  "worktreesPath": "~/worktrees",
  "repositories": [
    {
      "name": "vela",
      "path": "~/Workspaces/vela",
      "developmentBranch": "main",
      "hotfixBranch": "production"
    }
  ]
}
```

| Field                              | Required | Default       | Description                              |
| ---------------------------------- | -------- | ------------- | ---------------------------------------- |
| `worktreesPath`                    | no       | `~/worktrees` | Where worktrees are created              |
| `repositories[].name`              | yes      | —             | Short name used with `--repo`            |
| `repositories[].path`              | yes      | —             | Path to the repository (`~` is expanded) |
| `repositories[].developmentBranch` | no       | `main`        | Base branch for `--type feature`         |
| `repositories[].hotfixBranch`      | no       | —             | Base branch for `--type hotfix`          |

Jira credentials are not part of this file — they come from the environment, so no secret is
ever written to disk. See [Jira](#jira).

Invalid config fails immediately and names the offending field, e.g.
`Invalid config at …: repositories.0.path: Invalid input`.

### Working without a config file

`--repo` also accepts a path, so the CLI is useful before you configure anything:

```bash
worktree list --repo ./path/to/repo
worktree create --repo ./path/to/repo --name spike
```

In that mode the development branch is detected from `origin/HEAD`, and `--type hotfix`
requires either a configured `hotfixBranch` or an explicit `--base`.

## Jira

Jira is used to turn a ticket into a branch name — either by picking from your current sprint
or by passing `--ticket ABC-123` directly. Either way the result is
`feature/ABC-123-<slugified-summary>`. It is read-only: nothing is ever written back to Jira.

Queries go to `GET /rest/api/3/search/jql`, the current search endpoint (`/rest/api/3/search`
was removed from Jira Cloud).

It reads your Atlassian credentials from the environment — all three are required:

```bash
export ATLASSIAN_URL=https://your-org.atlassian.net
export ATLASSIAN_EMAIL=you@example.com
export ATLASSIAN_API_TOKEN=…
```

Create a token at <https://id.atlassian.com/manage-profile/security/api-tokens>. Nothing Jira
related is stored in the config file, so no secret is written to disk. `worktree config show`
reports whether each variable is set, and prints `(set)` rather than the token itself.

If one is missing, `--ticket` fails immediately and names the variable to set.

Pass `--name` alongside `--ticket` to keep the issue key but write your own description:

```bash
worktree create --repo vela --ticket ABC-123 --name "login redirect"
# -> feature/ABC-123-login-redirect
```

If your projects have no sprint field, the sprint query fails with a message telling you to
re-run with `--all-issues`.

## Environment variables

| Variable          | Effect                                          |
| ----------------- | ----------------------------------------------- |
| `WORKTREE_CONFIG` | Config file path (overridden by `--config`)     |
| `WORKTREE_DEBUG`  | Set to any value to print debug lines to stderr |
| `XDG_CONFIG_HOME` | Base directory for the default config location  |

Plus the three Atlassian variables required by `--ticket`: `ATLASSIAN_URL`,
`ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN`.

## Development

```bash
pnpm install
pnpm dev list           # run from source
pnpm test
pnpm check-types
pnpm lint && pnpm format
pnpm build
```

Dependencies use exact versions — no `^` or `~`.

### Layout

```
src/
  cli.ts            entry point: routing + the single error handler
  commands/         one file per subcommand, thin arg handling
  lib/              git, jira, config, claude-projects, prompts, help
  utils/            single-purpose helpers, one export each
tests/              vitest suites, including real git integration tests
```

Errors are handled once, in `cli.ts`. Subcommands throw with an actionable message and never
catch or call `process.exit`; API clients map HTTP status codes to user-facing messages in one
place.

## Releasing

CI runs lint, format, types, tests and the build on every push and pull request to `main`.

Publishing is driven by tags. The workflow re-runs the whole gate, refuses to continue if the
tag does not match `package.json`, smoke-tests the built binary, and publishes with
[provenance](https://docs.npmjs.com/generating-provenance-statements/):

```bash
npm version patch      # or minor / major — commits and tags
git push --follow-tags # tag push triggers the publish workflow
```

`workflow_dispatch` runs the same job with `dry-run` enabled by default, so the packaging can
be checked without releasing.

### One-time setup

Publishing needs an npm [granular access token](https://docs.npmjs.com/about-access-tokens/)
in the repository secrets as `NPM_TOKEN` (Settings → Secrets and variables → Actions). Legacy
"automation" tokens were removed in November 2025; granular tokens are all that remain.

Two settings on the token matter:

- **Packages and scopes** — read/write on the `@moraes` scope. Scope rather than package,
  because the package does not exist before the first publish.
- **Bypass 2FA** — must be enabled. It defaults to off, and without it CI fails with
  `EOTP: This operation requires a one-time password from your authenticator`.

npm's [trusted publishing](https://docs.npmjs.com/trusted-publishers/) removes the long-lived
token entirely and is the better end state, but it cannot perform a package's _first_ publish —
npmjs.com requires the package to exist before a trusted publisher can be configured. So
release the first version with a token, then switch: register this repo and
`.github/workflows/publish.yml` as a trusted publisher and delete the secret. That switch also
means adding an `npm install -g npm@latest` step, since OIDC needs npm >= 11.5.1 — newer than
the npm bundled with Node 22.

## License

MIT — see [LICENSE](LICENSE).
