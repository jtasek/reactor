# Copilot instructions for reactor

reactor is a browser-based design/diagramming/prototyping tool (shapes, links, layers,
groups, rulers on a canvas). It is a React 19 + TypeScript SPA whose entire application
state lives in a single [Overmind](https://overmindjs.org) store.

## Commands

The repo uses **pnpm** (see `pnpm-lock.yaml`). Use `pnpm` for installs.

- Dev server: `pnpm start` — runs `node server.js` (Express + webpack-dev-middleware + HMR) on http://localhost:4000.
- Tests: `pnpm test` (Jest, transformed via `@swc/jest`).
  - Single file: `pnpm test src/app/__tests__/utils.test.ts`
  - By name: `pnpm test -- -t "name of test"`
- Type-check: `pnpm tsc` (`tsc --noEmit`). Build does emit; this script does not.
- Lint: `pnpm lint` (`eslint src --fix`).
- Production build: `pnpm build`.

Note: some scripts in `package.json` are stale (e.g. `build:webpack` references a
non-existent `webpack.config.js`; the real config is `webpack.config.mjs`). The dev
server and tests are the reliable workflows.

## Architecture

The store is assembled in `src/app/index.ts` via Overmind's `merge` + `namespaced`:

- Root namespace: `actions`, `effects`, `state` from `src/app/`.
- Namespaced modules: `events`, `tools`, `ui` (each a self-contained module under
  `src/events/`, `src/tools/`, `src/ui/` with its own `state.ts`, `actions.ts`, `types.ts`).

So state is reached as `state.events.pointer`, `state.tools`, `state.ui`, while
document data is at the root (`state.currentDocument`, `state.documents`).

Key flow: React components → hooks (`src/app/hooks.ts`) → actions mutate store →
Overmind re-renders. Components never mutate state directly.

- **State** (`src/app/state.ts`, `src/app/types.ts`): an `Application` holding
  `documents` keyed by id; each `Document` holds dictionaries of `shapes`, `links`,
  `layers`, `groups`, `rulers` keyed by id, plus `*Ids` derived arrays.
- **Computed/derived** (`src/app/computed/`, `src/events/computed/`): use Overmind
  `derived(...)`. The `*Ids` and `selected*` fields in state are wired to these
  derived selectors — keep derivations here, not inline in components.
- **Actions** (`src/app/actions/`): one file per domain (`shape.ts`, `link.ts`,
  `layer.ts`, `group.ts`, `ruler.ts`, `document.ts`, `commands.ts`, …), all re-exported
  from `actions/index.ts`. Actions receive the Overmind `Context` and mutate state in place.
- **Effects** (`src/app/effects.ts`): side-effecting/impure helpers (id generation via
  `newId`, localStorage persistence, `page` routing). Call effects from actions
  (e.g. `effects.newId()`), don't import these libs directly in actions.
- **Events** (`src/events/`): pointer/keyboard/clipboard input. `drivers/` are React
  hooks (e.g. `useKeyboardDriver`, `usePointerAdapter`) mounted in `Shell` that
  translate DOM events into store actions.
- **Tools** (`src/tools/`): drawing tools (`RectTool`, `CircleTool`, `SelectTool`, …),
  each a component + actions; tool state lives in the `tools` namespace.
- **Renderers** (`src/app/renderers/`): pluggable output renderers (`SvgRenderer`,
  `CanvasRenderer`, `HtmlRenderer`, `PdfRenderer`, …) that draw the current document.
- Entry: `src/index.tsx` creates the Overmind instance and wraps `<Shell>` in the
  overmind-react `<Provider>`. `Shell` (`src/app/components/Shell.tsx`) switches between
  `Designer` and `Documents` pages based on `state.currentPage`.

## Conventions

- **Access state only through hooks** in `src/app/hooks.ts`
  (`useAppState`, `useActions`, `useEffects`, plus domain hooks like `useShapes`,
  `useCurrentDocument`, `useCamera`). Add new domain hooks here rather than calling
  `useAppState` with ad-hoc selectors in components.
- **Action typing**: use the aliases in `src/app/types.ts` —
  `Action = (context) => void`, `ActionWithParam<T> = (context, param) => void`,
  `ActionGuard = (context) => boolean`. Destructure what you need from context
  (`{ state }`, `{ state, effects }`). See `src/app/actions/shape.ts` for the canonical
  pattern (private `getShape`/`setShape`/`deleteShape` helpers + exported actions).
- **Commands**: actions can be run through the command layer
  (`actions/commands.ts`: `canExecuteCommand`/`executeCommand`, guarded by `ActionGuard`).
- **Path alias** `src/*` resolves to `./src` (configured in `tsconfig.json` and
  `webpack.config.mjs`). Mixed relative and `src/...` imports both appear; keep them in sync.
- **CSS Modules**: `*.css` with generated `*.css.d.ts` typings
  (typings-for-css-modules-loader). Don't hand-edit the `.d.ts` files.
- **Style** (Prettier `.prettierrc`): 4-space indent, single quotes, semicolons,
  `printWidth` 100, no trailing commas. ESLint enforces these plus `prettier/prettier: error`.
- **Tests** live in `__tests__/` folders next to the code they cover and use `@swc/jest`
  (TS/TSX transformed, no ts-jest). `*.test.ts` files are excluded from `tsc`.
- TypeScript is `strict`; avoid `any`. `console.log` triggers a lint warning
  (only `warn`/`error`/`info` are allowed) — prefer the `useLog` hook for debug output.
