# ADR: Undo and redo

Accepted design · 6 October 2026 · Not implemented.

Use one Yjs UndoManager per document/tab. Each completed user operation creates one step.
Undo/redo changes persist and sync; history itself lasts only for the browser session.
Implement permissions, atomic edit boundaries, and commit-only previews before history;
complete history before adding [chat](chat.md). All edit entry points share these boundaries.

## Behavior

- Undo: Cmd/Ctrl+Z. Redo: Cmd/Ctrl+Shift+Z; also Ctrl+Y on Windows/Linux.
- Register commands with labels such as “Undo Move 3 shapes”; disable unavailable commands.
- Text fields retain native undo. Committing a field creates one document step.
- Disable document history during any active canvas/guide edit, including pre-slip presses.
  Escape cancels the edit.
- Cancelled and unchanged edits preserve redo. New committed content clears redo.
  Selection, view changes, and incoming updates preserve it.
- Switching documents preserves each history. Reload clears it. Other tabs count as peers.
- Restore the operation's selection, filtered through current existence, visibility, and
  group rules. Keep the camera unchanged.

| Included                                     | Boundary                                  |
| -------------------------------------------- | ----------------------------------------- |
| Shape/image/text creation                    | Commit                                    |
| Move, resize, rotate, rounding               | Complete gesture                          |
| Inspector value, rename, visibility, lock    | Committed field or command                |
| Align, space, order, group, layer assignment | Command, including membership cleanup     |
| Paste, clone, cut, delete                    | All affected entities/references together |
| Guide create/move/remove                     | Release                                   |
| Document metadata, grid, content reset       | Content operation                         |
| Accepted AI edit                             | One validated operation                   |

Exclude selection, hover, bounds, filters, camera, panels, tools, chat, focused-layer view,
clipboard contents, uploads, document creation/deletion, accounts, and permissions. Reset
restores content only; its camera/filter changes are outside history. Images retain asset
references, not bytes. Undo Cut restores shapes but not the clipboard.

## Engine

Attach `Y.UndoManager` to each `Collaboration` binding after loading initial content. Scope
it to document fields and all collections: shapes, groups, layers, components, links, guides.

For installed Yjs 13.6.33:

- `trackedOrigins`: binding-local USER_EDIT origin.
- `captureTimeout: 0`: one transaction per completed operation.
- `ignoreRemoteMapChanges: false`: preserve superseding remote field values.
- Exclude initialization, system writes, and incoming updates. The manager owns replay origins.

Keep Yjs objects in the service. Overmind receives `canUndo`, `canRedo`, `undoLabel`, and
`redoLabel` through synchronous root actions. Components consume hooks.

## Edit boundary

```ts
interface EditBoundary {
    run(documentId: string, label: string, change: () => void): void;
    beginPreview(documentId: string, label: string): void;
    commitPreview(documentId: string): void;
    cancelPreview(documentId: string): void;
    undo(documentId: string): void;
    redo(documentId: string): void;
}
```

`run` flushes preceding committed work, prepares and validates the complete durable change,
then writes one USER_EDIT transaction synchronously. Nested actions join the outer operation.
Never span an `await`:
prepare uploads/clipboard/model results first, then recheck the document and commit.

Wrap user-intent entry points: commands, inspector/text commits, gesture/guide releases, and
AI execution. Opening a dialog creates no entry; its confirmed edit does. Existing draft
fields and text/guide previews need only a commit boundary.

Validate arguments before mutation. During `run`, journal before-images of every touched
store field/entity, including membership cleanup and selection, and hold automatic flushes.
Prepare a detached durable diff and validate every changed entity/reference before any Yjs
write. On callback or preparation failure, restore the journal and pending-change bookkeeping
without recording restoration as an edit. Publish nothing; preserve undo and redo stacks.

The current writer validates entities inside `Y.Doc.transact`; move that work before the
transaction. Yjs transactions do not roll back on exceptions. Commit only the prepared diff;
do not run editor callbacks or fallible parsing inside it. Clear pending changes after commit.
This covers action/validation failures, not process termination or out-of-memory failures.

Discard semantic no-ops before writing Yjs; timestamps alone do not count. Restore IDs/creation
metadata with entities; update modification timestamps outside capture without replacing maps.

## Prerequisite: commit-only previews

Today `Collaboration.receive()` writes pending local changes even while a gesture is paused.
That would capture intermediate/cancelled drags and clear redo. Change this before adding history.

| Stage         | Behavior                                                    |
| ------------- | ----------------------------------------------------------- |
| Begin         | Capture affected baseline, selection, and gesture intent    |
| Move          | Update Overmind preview only; Yjs remains committed content |
| Remote update | Update committed baseline, then reconstruct the preview     |
| Commit        | Validate and diff against latest baseline; write once       |
| Cancel        | Restore rebased baseline; write nothing; preserve history   |

Extend existing gesture snapshots to affected group fields and references. Read only touched
entities, untracked; avoid full-document clones. Reapply full gesture intent to the rebased
baseline, including group frames and measured bounds. Incremental pointer deltas alone are
insufficient after rebasing.

If a peer deletes, locks, or restructures a required target, cancel the invalid preview.
A peer's same-field edit becomes the baseline beneath a subsequent local commit; cancel
reveals it and Undo restores it. Test this change to current gesture-merging behavior.

Allow one preview per tab; defer unrelated local edits while it is active. Remote updates
continue. Cancel on document/account change, removal, teardown, or page hide. Autosave and
state-vector exports see committed content only. Never hold a Yjs transaction across a drag
or implement cancellation by invoking Undo.

## Replay, persistence, and metadata

The bridge currently broadcasts only `origin === LOCAL`. UndoManager uses its own origin;
route its updates explicitly or undo will neither persist nor sync.

| Origin                | Apply to store                  | Save/broadcast                 | New history                  |
| --------------------- | ------------------------------- | ------------------------------ | ---------------------------- |
| USER_EDIT             | Reconcile normalized references | Yes                            | Yes                          |
| Binding's UndoManager | Yes                             | Yes                            | Engine-managed inverse entry |
| Peer/server           | Yes                             | Existing receive path; no echo | No                           |
| Initial/system        | Existing load/repair behavior   | Existing policy                | No                           |

Replay flushes completed work, calls the manager, and projects changes through the existing
validated Yjs-to-store path. Rebuild `shapesIds`, normalize references, update/invalidate
bounds, and sanitize selection. Projection must not feed back into history.

Send local replay updates through `sendUpdate` to IndexedDB, tab sync, and server sync.
Store label, before/after selection, entered group, and optional AI request ID in stack-item
metadata; copy it to inverse entries. Restore selection after projection. Yjs can skip
obsolete entries: use the returned item's metadata, not a previously cached label.

## Collaboration and permissions

| Situation                           | Result                                                |
| ----------------------------------- | ----------------------------------------------------- |
| I move; a peer changes fill         | Undo position; preserve fill                          |
| I set x; a peer later sets x        | Preserve peer value; obsolete entry may be skipped    |
| A peer edits after my Undo          | Preserve redo and their unrelated edits               |
| A peer deletes an object I moved    | Undo Move does not resurrect it                       |
| I delete an object                  | Undo can restore it and captured relationships        |
| I create an object; a peer edits it | Undo Create removes the object, including their edits |

Undo emits a new collaborative update. It can be partial when fields were superseded;
show a notice when no effective change remains. Never force a historical whole-document
snapshot or promise that structural undo cannot affect peers.

Use the shared [document access policy](chat.md#tools) for commands, previews, and history.
Preserve workspace roles as device-local document access state; unknown access blocks
server-document edits. Access loss cancels previews and disables replay. The server must
reject unauthorized writes after role changes, including on already-open sync connections.
Cached client access is not authorization; local documents without accounts remain editable.

Server roles remain authoritative: viewers cannot replay history. Shape locks are editing
aids and can themselves be undone. A document lock blocks history except reversing this
tab's still-current Lock document operation; a subsequent peer lock must block that exception.

## Lifetime and AI

- Retain history while the document is loaded. On removal, binding close, sign-out, or
  disposal, call `clear()` then `destroy()` before releasing the Y.Doc.
- Keep stacks out of persistence and shared content. Asset garbage collection must retain
  bytes referenced by history; current storage already retains removed shapes' assets.
- Session retention has no hard memory cap. Measure deletion-heavy/long sessions. Yjs
  13.6.33 has no public trim-oldest API; do not splice stacks. Safe pruning is a prerequisite
  if measurements require a cap. Offer explicit Clear history rather than silent resets.
- Chat/WebMCP/MCP edits use the same executor and history boundary. Proposals, cancellation,
  and model replies create no steps. Redo replays the recorded operation without inference.
- A future AI batch must validate fully or roll back its preview before commit. A chat
  message's Undo button is enabled only when its operation is next; it cannot undo later edits.

## Delivery and checks

1. Add document access state and revocation handling, then atomic edit boundaries and
   commit-only previews; prove failed/cancelled operations preserve redo under remote updates.
2. Add managers, origin routing, metadata, and reactive summaries; verify persistence/sync.
3. Wire every content-edit entry point, commands, shortcuts, and later the AI executor.
4. Run repository checks plus these behavioral cases:

    - Operation round-trips preserve IDs, geometry, order, memberships, references, and assets.
    - A thousand pointer moves yield one step; cancelled/no-op gestures yield none.
    - Two commands in one JS task yield two steps; nested actions yield one.
    - A callback or later entity's validation failure restores store state and bookkeeping,
      emits no Yjs/persistence/network update, and leaves both history stacks unchanged.
    - Conflicting fields, remote deletion, concurrent grouping, edit-then-delete, offline peers,
      and out-of-order delivery converge; test updates during previews explicitly.
    - Replay persists and reaches tabs/server peers without echo; reload retains content.
    - Native input undo, IME, guides, permissions, document-lock exception, and selection work.
    - Async results cannot cross document/account boundaries; no-ops preserve redo.
    - Viewer/unknown access blocks edits; revocation during a preview, pending proposal, or
      active sync connection cannot publish a newly unauthorized operation to the server.
    - Long-session retention, disposal, and drag performance remain acceptable.

Main changes: collaboration service/projection, a history adapter, hooks/actions/commands,
pointer gestures, inspector/text/guide commits, and client/server access enforcement.
No persisted document schema change is required.

## Evidence

Installed Yjs probes confirmed different-field preservation, same-field overwrite handling,
structural creation undo, edit-plus-delete restoration, and redo after remote edits.
Reactor integration remains untested.

[Yjs UndoManager reference](https://beta.yjs.dev/docs/api/undo-manager/)
