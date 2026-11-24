# reactor

A browser-based editor for designing and prototyping apps: draw pages and reusable
components, give them variables, data and interactions, play them as a prototype and share
it, with AI to make and change designs from words. Documents are kept in the browser or,
signed in, on a server that syncs them between devices and people.

## Requirements

- Node.js 22.18 or later, which runs the server's TypeScript directly
- pnpm 11, the version pinned in `package.json` (`corepack enable` provides it)
- Optional: PostgreSQL 17 for accounts and syncing, or Docker to run both with
  `compose.yaml`

## Getting started

```bash
git clone https://github.com/jtasek/reactor.git
cd reactor
pnpm install
pnpm start
```

Then open http://localhost:4000. Without a database, the editor runs signed out and
keeps documents in the browser. While the server offers no AI (none configured, or signed
out), the development build's AI chat answers from a local test model in the browser
(`src/ai/localModel.ts`); any build does the same with `?ai=local`, until `?ai=server`.
`?debug=on` shows developer readouts (status bar pointer and keyboard, Document Info,
Stats) in that tab until `?debug=off`.

To try Prototype, sharing and Download locally, run `pnpm start:local` instead: it builds the
preview runtime and starts the editor on http://localhost:4000 and the runtime on port 4001
(`PORT` and `PREVIEW_PORT` change them). Open `localhost`, not `127.0.0.1`.

## Commands

| Command | What it does |
|---|---|
| `pnpm start` | Development server with hot reload on port 4000 |
| `pnpm start:local` | Development server plus the preview runtime on loopback origins |
| `pnpm build` | Production build of the editor (`dist/`) and the preview runtime (`dist-preview/`) |
| `pnpm serve` | Production server for `dist/` (run `pnpm build` first) |
| `pnpm serve:preview` | Preview runtime server for `dist-preview/` |
| `pnpm check` | What CI runs: lint (scripts and CSS), type checks, unit tests and browser tests |
| `pnpm test` | Unit, store and server tests; `pnpm test:watch` reruns them on change |
| `pnpm test:browser` | Browser tests (Chromium) against a production build |
| `pnpm typecheck` | Type checks for the app, the tests and the server |
| `pnpm lint` | Lint report, failing on any finding; `pnpm lint:fix` applies automatic fixes |
| `pnpm ai:eval`, `pnpm ai:record` | Live AI evaluation of the edit cases; `ai:record` also replaces the recordings |
| `pnpm ai:screenshots:prepare`, `pnpm ai:screenshots:eval` | Screenshot-to-design references, and the live run against them |

## Configuration

The servers read their settings from the environment.

| Variable | Meaning |
|---|---|
| `PORT` | Port to listen on; 4000 by default |
| `HOST` | Address to listen on; `localhost` for the development server, `0.0.0.0` for the production server |
| `LOG_LEVEL` | Production server log level: `fatal`, `error`, `warn`, `info` (default), `debug`, `trace` or `silent` |
| `TRUST_PROXY` | Reverse proxies whose `X-Forwarded-*` headers the production server trusts: a hop count such as `1`, `true`, or addresses and subnets such as `loopback, 10.0.0.0/8`; none by default. Set it behind a proxy, since sign-in is rate limited per client address |
| `DATABASE_URL` | PostgreSQL connection string; turns accounts, syncing and sharing on |
| `BETTER_AUTH_URL` | The address people open the editor at, such as `https://reactor.example.com` |
| `BETTER_AUTH_SECRET` | At least 32 random characters, used to sign sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional; both turn on Google sign-in |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional; both turn on GitHub sign-in |
| `SMTP_URL` | SMTP server for email, such as `smtps://user:password@smtp.example.com`; required in production with `DATABASE_URL`, the development server logs email without it |
| `MAIL_FROM` | Sender address; `no-reply` at the editor's host by default |
| `AI_PROVIDER` | Turns AI on for signed-in people: `anthropic`, or `openai` for any server speaking OpenAI's Chat Completions API (OpenAI, Mistral, OpenRouter, Ollama, vLLM) |
| `AI_API_KEY` | The provider's key, kept on the server; required for `anthropic` (`ANTHROPIC_API_KEY` still works without `AI_PROVIDER`) |
| `AI_BASE_URL` | Where the `openai` provider's API is; `https://api.openai.com/v1` by default |
| `AI_EDIT_MODEL` | The model for edits; `claude-haiku-5-5` by default for `anthropic`, required for `openai` |
| `PREVIEW_ORIGIN`, `EDITOR_ORIGIN` | The preview runtime's and the editor's origins, the same on both servers (`EDITOR_ORIGIN` falls back to `BETTER_AUTH_URL`); without `PREVIEW_ORIGIN`, Prototype, shared links and Download are off |
| `PREVIEW_ALLOW_LOCALHOST` | `true` allows loopback origins for the preview runtime (local testing only) |
| `METRICS_TOKEN` | Turns on `/metrics` and its lists for requests sending it as `Authorization: Bearer <token>`; off by default |

The server stops at start with a clear message when a setting is invalid, such as `PORT`,
`TRUST_PROXY`, the preview origins, or only one of a provider's credential pair.

## Running it

`docker compose up --build` runs the production server with PostgreSQL: set
`POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` and `SMTP_URL` first. The server creates and
migrates its tables on start.

**Sign-in providers.** Register these callback URLs in the provider's OAuth application, on
your `BETTER_AUTH_URL` origin (or `http://localhost:4000` in development):

- Google: `https://reactor.example.com/api/auth/callback/google`
- GitHub: `https://reactor.example.com/api/auth/callback/github`

**Preview runtime.** Prototype, shared links and Download play documents in a separate static
server (`pnpm serve:preview`, or `node server.preview.ts` in the same image). It must be on an
app subdomain of a different site from the editor (different final two hostname labels, no IP
address), both over HTTPS, without the editor's cookies, and deployed from the same release as
the editor.

**AI.** For an OpenAI-compatible endpoint, set `AI_PROVIDER=openai`, `AI_BASE_URL` to its API
base (with `/v1` when required) and `AI_EDIT_MODEL`; it must stream Chat Completions with
function tools, and take images for screenshot requests. A request sends the person's words
and the selected part of the document, or the whole document, to the provider. The server
keeps only an `ai_requests` row (who, when, which document, the model and the tokens), and
the limits per person and workspace are `AI_LIMITS` in [server/ai.ts](server/ai.ts).
Workspace admins can turn AI off on Sharing.

## Metrics and error reports

With `METRICS_TOKEN` set, these answer requests that send it:

| Path | What it gives |
|---|---|
| `/metrics` | Server metrics in the Prometheus text format: sync sockets, saves, AI turns and timings, prototype links and sessions, feedback and browser errors. Counters start at zero with each process |
| `/metrics/prototypes` | Every prototype link shared, newest first, with its screens, distinct players, opens and last open |
| `/metrics/first-links` | Each person's first shared link and how long it took them |
| `/metrics/beta` | The R7 measures for the last 12 weeks (UTC, from Monday): sign-ups, sign-ups that shared a two-screen prototype within a day, and prototype sessions; windows in `BETA_MEASURES` ([server/services/prototypeLinks.ts](server/services/prototypeLinks.ts)) |
| `/metrics/feedback` | The newest 200 messages sent with Send feedback, with the sender's email, page and document format |

Players are counted by a random id the `/share` page keeps per browser; the server stores only
its hash with the link. The editor sends unhandled errors to `POST /api/client-errors`, which
the server logs as `browserError`. Nothing is sent to a third party.

## History and backups

Signed in, the server keeps earlier states of each document as snapshots in the same
database: all from the last day, then each document's last of the day for 30 days, and a
deleted document's last content for 30 days. Editors restore them from Document history;
admins restore deleted documents from Documents → Recently Deleted. Snapshots are not backups.

`scripts/backup-database.sh` writes a `pg_dump` custom-format file of `DATABASE_URL` into
`BACKUP_DIR` (default `./backups`), checks that `pg_restore` can read it, and deletes dumps
older than `BACKUP_KEEP_DAYS` (default 14). Keep the password in `~/.pgpass` (or `PGPASSFILE`)
rather than the URL on a shared machine. Run it daily and copy `BACKUP_DIR` off the machine:

```sh
# crontab: every day at 03:15
15 3 * * * cd /srv/reactor && DATABASE_URL=postgres://... scripts/backup-database.sh
```

With Docker Compose, back up from the database container:
`docker compose exec -T db pg_dump -U reactor --format=custom reactor > reactor.dump`.
To restore, stop the app, create an empty database and run
`pg_restore --no-owner --no-privileges --exit-on-error --dbname=<empty database URL> reactor.dump`,
then point `DATABASE_URL` at it and start the app, which migrates it if needed.

`scripts/restore-drill.sh` backs up `DATABASE_URL`, restores the dump into the empty database
at `DRILL_DATABASE_URL`, and compares every table's row count and a checksum of all document
content and snapshots. Run it against the beta's database before the beta opens, then monthly,
and add a row here each time.

| Date | Where | Result |
|---|---|---|
| 2026-11-14 | Local PostgreSQL 16.15, seeded with 5 accounts, 35 documents (7,000 shapes), 5 deleted documents, 45 snapshots and 40 images | Passed: 716 KB dump restored in 1 s; all 18 tables and both checksums matched, the restored database migrated on start and every document read back |

## Architecture

- **Editor** (`src/`): a React 19 and TypeScript single-page app whose state lives in one
  Overmind store (`src/app/`), with `src/events/`, `src/tools/` and `src/ui/` as its
  namespaces. Pages are in `src/pages/`, AI in `src/ai/`, export in `src/export/`.
  Bundled with webpack and SWC; the production build fails beyond the bundle budget in
  `webpack.config.mjs`.
- **Saving**: each document is a Yjs document kept in the browser's `reactor` IndexedDB
  database; open tabs share changes over a BroadcastChannel. Signed in, every document syncs
  with the server over one WebSocket at `/sync`, and images are content-addressed and synced.
  Each person undoes only their own changes.
- **Server** (`server.ts` for development, `server.prod.ts` for production, `server/`):
  Express with Better Auth sign-in, the workspace and document API at `/api`, sync, the AI
  gateway at `/api/ai`, prototype links and metrics, on PostgreSQL. The Docker image copies
  only `server/`, `src/shared/` and the files it lists, so the server imports nothing else
  from `src/`.
- **Preview runtime** (`src/preview/`, `server.preview.ts`, `webpack.preview.mjs`): a sandboxed
  page on its own domain that plays a projection of the document; it serves no accounts or
  documents and sends nothing back. Download wraps it into one offline HTML file.

[AGENTS.md](AGENTS.md) explains the code in depth,
[APPLICATION_PLAN.md](APPLICATION_PLAN.md) describes the work ahead and its order, and
[DELIVERY_LOG.md](DELIVERY_LOG.md) what each step delivered.

## Development

CI runs `pnpm check`, and a second job builds the Docker image, runs it and checks it with
`node scripts/smoke.mjs <address>`. The **Nightly** workflow runs the browser tests in WebKit
(`BROWSERS=webkit pnpm test:browser`) and the server tests on PostgreSQL 17. Known flaky browser
tests are listed in [tests/browser/FLAKY.md](tests/browser/FLAKY.md).

Install the test browser once with `pnpm exec playwright install chromium` (Linux may need
`--with-deps`). Browser tests use port 4173 and start both origins themselves; traces of
failures are kept in `test-results/`. `tests/support/store.ts` creates independent stores with
in-memory storage; startup is opt-in with `store.onInitialize()`. Server tests run against
PGlite, or against a PostgreSQL server with `TEST_DATABASE_URL` (its `postgres` database, by a
user that may create databases), each test on its own copy of an empty database.

**AI evaluations.** `pnpm test tests/ai/cases.test.ts` replays the edit cases through both
provider adapters, the gateway and two collaborating editors from recordings and hand-written rounds, so it checks
the protocol and the editor, not model quality. With a provider configured, `pnpm ai:eval`
calls it live and writes `test-results/ai-eval.json`, with gates on validity, the requested
result and latency, and `AI_EVAL_BASELINE` set to an earlier report fails on a drop in the
pass rate. The **AI evaluation** workflow runs it nightly once the repository variable
`AI_EVAL_ENABLED=true` is set, with `AI_PROVIDER`, `AI_EDIT_MODEL`, optional `AI_BASE_URL`
and the secret `AI_API_KEY`. `pnpm ai:screenshots:prepare` renders 30 references from the
starter templates and `pnpm ai:screenshots:eval` runs the model on them, writing a report
to `AI_SCREENSHOT_OUTPUT` (a fresh directory each run) for two people to rate in `ratings.json`.
