# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
Guidance for Claude when working in this repository.

## What this is

**reactor** is a browser-based design / diagramming / prototyping tool (shapes, links,
layers, groups, rulers on a canvas). It is a **React 19 + TypeScript** SPA whose entire
application state lives in a single [Overmind](https://overmindjs.org) store. Bundling is
done with **webpack + SWC**; it is served by **Express** in dev and a hardened static
server in production.

## Commands

The repo uses **pnpm** (`pnpm@11.5.0`, see `pnpm-lock.yaml`). Use `pnpm` for installs.

- **Dev server**: `pnpm start` — `node server.js` (Express + webpack-dev-middleware + HMR /
  React Fast Refresh) on http://localhost:4000.
- **Type-check**: `pnpm tsc` (`tsc --noEmit`). `*.test.ts` files are excluded from `tsc`.
- **Lint**: `pnpm lint` (`eslint src --fix`). Flat config in `eslint.config.mjs`.
- **Tests**: `pnpm test` (Vitest, `globals: true` — no need to import `describe`/`it`/
  `expect`/`vi`). `pnpm test:watch` for watch mode.
    - Single file: `pnpm test src/app/__tests__/utils.test.ts`
    - By name: `pnpm test -- -t "name of test"`
- **Production build**: `pnpm build` — `NODE_ENV=production` webpack via `webpack.config.mjs`.
  Content-hashed JS/CSS, extracted CSS, generated `dist/index.html`. Overmind devtools and
  source maps off.
- **Production server**: `pnpm serve` — hardened static server `server.prod.js` (helmet/CSP,
  compression, immutable caching, SPA fallback, `/healthz`, graceful shutdown). Never ship
  the dev `server.js`.
- **Container**: `Dockerfile` (multi-stage, non-root `node` user) builds and runs
  `server.prod.js`.

### Verification baseline (do not treat as regressions)

- `pnpm tsc` reports a number of **pre-existing** errors (implicit-`any` in some state/
  components, named-capture-group regex errors in tools targeting < ES2018). When changing
  code, keep the error count at or below the current baseline rather than expecting zero.
- A few `utils.test.ts` tests fail on a clean checkout (`isCircleInBox`, `isEllipseInBox`,
  `overlaps` logic bugs). Leave them unless the task is to fix them.
- `pnpm build` finishes with **2 performance warnings** (bundle size). That is expected.

## Architecture

The store is assembled in `src/app/index.ts` via Overmind `merge` + `namespaced`:

- Root namespace: `actions`, `effects`, `state` from `src/app/`.
- Namespaced modules: `events`, `tools`, `ui` (self-contained under `src/events/`,
  `src/tools/`, `src/ui/`, each with its own `state.ts`, `actions.ts`, `types.ts`).

So state is reached as `state.events.pointer`, `state.tools`, `state.ui`; document data is
at the root (`state.currentDocument`, `state.documents`).

Key flow: **React components → hooks (`src/app/hooks.ts`) → actions mutate store → Overmind
re-renders.** Components never mutate state directly.

- **State** (`src/app/state.ts`, `src/app/types.ts`): an `Application` holding `documents`
  keyed by id; each `Document` holds dictionaries of `shapes`, `links`, `layers`, `groups`,
  `rulers` keyed by id, plus `*Ids` derived arrays.
- **Computed/derived** (`src/app/computed/`, `src/events/computed/`): Overmind `derived(...)`.
  `*Ids` and `selected*` fields are wired to these — keep derivations here, not in components.
  The pointer drag model lives in `src/events/computed/pointer.ts` (`topLeft`, `size`,
  `bottomRight`, `center`, `radius`, `offset`).
- **Actions** (`src/app/actions/`): one file per domain (`shape.ts`, `link.ts`, …),
  re-exported from `actions/index.ts`. Actions receive the Overmind `Context` and mutate
  state in place. `src/app/actions/shape.ts` is the canonical pattern (private
  `getShape`/`setShape`/`deleteShape` helpers + exported actions).
- **Effects** (`src/app/effects.ts`): impure helpers (`newId`, localStorage, routing). Call
  them from actions (`effects.newId()`); don't import those libs directly in actions.
- **Events** (`src/events/`): pointer/keyboard/clipboard input. `drivers/` are React hooks
  (e.g. `useKeyboardDriver`, `usePointerAdapter`) mounted in `Shell` that translate DOM
  events into store actions.
- **Tools** (`src/tools/`): drawing/selection tools; tool state lives in the `tools` namespace.
- **Renderers** (`src/app/renderers/`): pluggable output renderers (Svg/Canvas/Html/Pdf).
- Entry: `src/index.tsx` creates the Overmind instance and wraps `<Shell>` in the
  overmind-react `<Provider>`. `Shell` switches between `Designer` and `Documents` pages.

## Tool lifecycle (read before touching tools)

A `Tool` (`src/tools/types.ts`) extends a `Command` with `component` (renders committed
shapes) and `designComponent` (the in-progress preview, rendered by `Stack`).

The pointer gesture is driven in `src/events/drivers/usePointerAdapter.ts`:

- **pointer down** → `startDragging` + `setStartPosition`/`setCurrentPosition`.
- **pointer move** → `updateCurrentPosition` (derived `topLeft`/`size`/… recompute).
- **pointer up** (while dragging) → `endDragging` → `executeToolCommands()` → `resetTools()`,
  **synchronously**. React effects flush _after_ this, so anything a tool must persist on
  release has to happen inside the synchronous `execute` (not a mount/layout effect).

`executeToolCommands` (`src/tools/actions.ts`) runs `execute(context)` for each active tool
when `canExecute(context)` is true. `resetTools` deactivates a tool when its
`shouldDeactivate(context)` returns true (return `true` = deactivate now).

Examples worth modelling new tools on:

- `Rect` — canonical simple tool using `pointer.topLeft` / `pointer.size`.
- `Image` — rect-like, but preserves the image's **intrinsic** aspect ratio (measured from a
  probe `Image`, never hardcoded).
- `Text` — two-phase: select tool → click canvas to place + enter typing mode → type → Enter
  to commit (Escape cancels). The placement click starts typing inside `execute` (synchronous).
- `Select` — marquee: press + drag draws the dashed rect; `selectShapes` selects shapes that
  overlap it (authoritative: sets `selected` true/false), and the selection persists on release.

## Bounding boxes & selection

- `getBoundingBox(shape)` (`src/app/utils.ts`) computes an **analytic** box per shape type.
- Each rendered shape is also **measured** with `getBBox()` in `src/ui/components/Shape/Shape.tsx`
  (the shape's primitive is wrapped in a `<g ref>`), and the result is stored as `shape.bounds`
  via the `setShapeBounds` action. `getBBox` returns canvas-space coords, unaffected by the
  camera pan/zoom transform on ancestor groups.
- **Always read bounds via `getShapeBounds(shape)`** (measured `bounds` when present, analytic
  fallback otherwise). Consumers: `Selectable`, `Resizable`, `Label`, plus `selectShapes` and
  `isPointInBox`.
- Performance rules for the hot path:
    - The measurement effect is keyed on `shapeGeometryKey(shape)` so toggling `selected` during
      a marquee drag does **not** force a reflow. Keep it that way.
    - `setShapeBounds` writes idempotently (epsilon compare) and `selectShapes` only writes
      `selected` when it changes — both avoid render loops / churn. Preserve these guards.

## Conventions

- **Access state only through hooks** in `src/app/hooks.ts` (`useAppState`, `useActions`,
  `useEffects`, domain hooks like `useShapes`, `useCurrentDocument`, `useCamera`). Add new
  domain hooks here rather than ad-hoc `useAppState` selectors in components.
- **Action typing**: use the aliases in `src/app/types.ts` — `Action`, `ActionWithParam<T>`,
  `ActionGuard`. Destructure what you need from context (`{ state }`, `{ state, effects }`).
- **Commands**: actions can run through the command layer (`actions/commands.ts`:
  `canExecuteCommand`/`executeCommand`, guarded by `ActionGuard`).
- **Path alias** `src/*` → `./src` (in `tsconfig.json` and `webpack.config.mjs`). Mixed
  relative and `src/...` imports both appear; keep them consistent within a file.
- **CSS Modules**: `*.css` with generated `*.css.d.ts` typings. Don't hand-edit the `.d.ts`.
- **Style** (Prettier `.prettierrc`): 4-space indent, single quotes, semicolons, `printWidth`
  100, no trailing commas. ESLint enforces these plus `prettier/prettier: error`.
- TypeScript is `strict`; **avoid `any`**. `console.log` is a lint warning (only
  `warn`/`error`/`info` allowed) — prefer the `useLog` hook for debug output.
- `jsx-a11y/no-autofocus` is an **error**: focus inputs via a ref effect, not `autoFocus`.
- Prefer **early returns** over `else` branches.

## Workflow expectations

- Make surgical, complete changes; don't fix unrelated pre-existing issues unless the task
  requires it.
- Validate with the **smallest** targeted command first (`pnpm tsc`, `eslint <file>`, a single
  Vitest file), then a build if the change affects bundling/runtime.
- Commits use Conventional Commit prefixes (`fix(...)`, `feat(...)`, `perf(...)`) and end with:

    ```
    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
    ```
