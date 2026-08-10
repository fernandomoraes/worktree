# @fernandomoraes/worktree

A CLI for the git worktree loop: create one per ticket or hotfix, list what you have open, and
clean them up — including the `~/.claude/projects` directory that Claude Code leaves behind for
each worktree path.

```bash
npm install -g @fernandomoraes/worktree
```

Requires **Node.js >= 24** and **git** on `PATH`.

## Quick start

```bash
worktree config init                          # scaffold ~/.config/worktree/config.json
worktree create --repo vela --ticket ABC-123  # branch name comes from the Jira summary
worktree list                                 # see what is open
worktree clean --repo vela --branch feature/ABC-123-fix-login-redirect
```

## Design

The CLI is built for humans and agents at the same time:

- **Flags are the interface.** Every command runs unattended. Interactive prompts only fill in
  a missing flag when a TTY is attached; in a pipe or CI the same input is an actionable error,
  never a hanging prompt.
- **Structured output.** Data goes to stdout as `key: value` lines or tab-separated rows;
  diagnostics and errors go to stderr. `list` and `config show` also take `--json`.
- **Idempotent.** Re-running `create` reports the existing worktree instead of failing;
  `clean` on an already-clean repo is a no-op.
- **Safe by default.** Destructive commands support `--dry-run`, prompt before acting, and
  refuse to discard uncommitted work unless you pass `--force`.
- **Exit code 0 on success, 1 on failure**, with the reason on stderr and a suggested fix.

## Commands

Run `worktree <command> --help` for the full flag list and examples.

### `worktree list`

Lists worktrees across every configured repository as `repository<TAB>branch<TAB>path`.

| Flag              | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `--repo <ref>`    | Limit to one repository: a config name or a path to a git repo    |
| `--all`           | Include each repository's primary worktree (excluded by default)  |
| `--json`          | Emit JSON, including `head`, `locked`, and `claudeProject` status |
| `--config <path>` | Use a specific config file                                        |

### `worktree create`

Creates a worktree at `<worktreesPath>/<repository>/<name>` on a new branch.

| Flag              | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `--repo <ref>`    | Repository name from config, or a path to a git repository               |
| `--ticket <key>`  | Jira issue key; its summary becomes the branch name                      |
| `--name <text>`   | Free-form name; overrides the Jira summary when combined with `--ticket` |
| `--type <type>`   | `feature` (default) or `hotfix` — selects the base branch                |
| `--base <branch>` | Start from an explicit branch instead of the configured one              |
| `--no-fetch`      | Skip fetching the base branch from `origin`                              |
| `--dry-run`       | Print what would be created without touching the filesystem              |
| `--config <path>` | Use a specific config file                                               |

`--type feature` branches from the repository's `developmentBranch`; `--type hotfix` branches
from its `hotfixBranch`. The base branch is fetched from `origin` first unless `--no-fetch` is
set, so new worktrees start from the current remote state.

```
$ worktree create --repo vela --ticket ABC-123
created worktree
repository: vela
branch: feature/ABC-123-fix-login-redirect
base: origin/main
path: /Users/you/worktrees/vela/ABC-123-fix-login-redirect
```

If the branch already exists locally, it is reused rather than recreated.

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
| `--config <path>`       | Use a specific config file                            |

```
$ worktree clean --repo vela --branch feature/ABC-123-fix-login-redirect --yes
removed worktree
repository: vela
branch: feature/ABC-123-fix-login-redirect
path: /Users/you/worktrees/vela/ABC-123-fix-login-redirect
claude_project: /Users/you/.claude/projects/-Users-you-worktrees-vela-ABC-123-fix-login-redirect
removed: 1
```

`claude_project` reports the removed path, `none` if there was nothing to remove, or `kept`
when `--keep-claude-project` is set.

With no `--branch` and no `--all`, an interactive terminal gets a multi-select of open
worktrees; a non-interactive one gets an error telling you which flag to pass.

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

`--ticket ABC-123` fetches the issue summary and builds `feature/ABC-123-<slugified-summary>`.

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

## License

MIT
