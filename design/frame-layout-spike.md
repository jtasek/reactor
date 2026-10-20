# R4 frame layout spike

Status: first spike complete, 2026-10-19. This is test-only research, not a shipped frame
editor or a durable document format. Production fixed stacks are now implemented separately in
`src/app/frameLayout.ts`; see APPLICATION_PLAN.md for shipped behavior and remaining limits.

## Result

A pure layout pass can project the same merged frame rules into the same canvas boxes on
two Yjs copies. Share authored rules and sizes; recompute positions after a committed edit
and after receiving a merged snapshot. The prototype never writes computed positions back
into Yjs. This avoids adding layout-only changes to undo or syncing stale offline positions
on top of newer rules.

The prototype is [frameLayout.ts](../tests/spikes/frameLayout.ts). Its executable acceptance
cases are [frames.test.ts](../tests/frames.test.ts):

- fixed-size row and column stacks, uniform padding, gaps and cross-axis alignment;
- nested frames and free positioning, projected into canvas coordinates;
- stable sibling order with an ID tie-breaker, independent of map insertion order;
- a rule edit concurrent with a child-size edit;
- independent edits to nested rule fields (direction and gap both survive);
- insertion, reorder and resize with delayed and repeated state delivery;
- concurrent reparenting using one parent register per child, with each copy as the winner;
- deletion of a parent concurrent with insertion of a child;
- a parent cycle created by two individually valid offline edits;
- undo of a local rule edit while keeping another copy's size edit;
- invalid geometry, unreadable stack rules, non-frame parents, visible overflow and 2,000
  nested frames.

Run `pnpm test tests/frames.test.ts`.

The harness uses nested Y.Maps like production's field-by-field entity representation.
It is deliberately independent of the production Collaboration service: passing these cases
proves the candidate algorithm on merged snapshots, not the full editor integration.

## Proposed integration boundaries

- Frames remain separate records, with their own boxes. Shapes keep their existing types;
  groups remain selected as a whole. A top-level frame can become a screen.
- One parent reference per child prevents concurrent edits from duplicating membership.
  Siblings use stable order keys and an ID tie-breaker.
- Layout is a pure projection of validated authored data. Render, hit testing and measurement
  must consume the same boxes. Do not serialize derived layout positions or feed them back
  through the mutation listener as new authored edits.
- Invalid parent edges are omitted from the local projection with diagnostics, leaving those
  items visible as roots. All edges within a parent cycle are omitted; descendants outside
  the cycle stay attached. No repair is written back to other copies.
- A frame whose stack rules a copy cannot read (an unknown direction or alignment, a missing
  or negative gap or padding) keeps its box and places its children by their own positions,
  with an `invalid-stack` diagnostic. Only invalid geometry drops an item from the projection.
- Fixed-size children keep their size on overflow. The prototype reports overflow rather
  than silently shrinking or clipping artwork.

These are spike decisions to test in the editor, not new production invariants. Existing
shapes store canvas coordinates; the spike uses parent-local authored positions. The first
integration must explicitly convert at this boundary and verify move, resize, reparent,
copy/paste and deletion preserve visible geometry. In particular, ordinary frame deletion
must keep children's canvas positions; concurrent missing-parent recovery still needs an
editor-specific policy. Existing local-only collaboration repairs provide a precedent,
not proof that the new frame integration works.

## Next usable increments

1. Add validated frame records and membership through factories, readers, serialization,
   operations, copying, collaboration and undo together. Bump the document schema as the
   pre-beta policy requires. Ship free-positioned frames with visible boundaries, names,
   keyboard/Explorer selection, box editing and explicit reparenting. Do not change group
   selection semantics. Cover concurrent deletion/reference through production copies.
2. Integrate fixed row/column layout. Connect the projection to drawing, selection bounds,
   hit testing and committed edits. Verify that applying remote changes cannot cause a
   mutation/undo feedback loop. Add stack controls for gap, padding and alignment.
3. Add hug/fill and min/max sizing with a defined policy for cyclic sizing dependencies.
   Cover rotated shapes, text measurement, variables, groups, layers and component instances
   before exposing unsupported combinations. Then add component roles and props.

The spike does not implement durable frame data, editor controls, hug/fill sizing, roles,
preview, navigation, exports or a renderer/plugin framework.

## Measurement

Run `node scripts/bench-frame-layout.ts`: 20 warm-up passes, then 100 measured passes of one
row frame with fixed-size children and distinct order keys. Informal figures from one run on
Node 22.22.0 in a shared cloud container; they vary from machine to machine:

| Children | Median layout | p95 layout |
| -------- | ------------- | ---------- |
| 300      | 0.291 ms      | 0.486 ms   |
| 2,000    | 1.525 ms      | 2.547 ms   |

These are isolated projection timings, excluding validation of untrusted input, Yjs merge,
store propagation, rendering and hit testing. They do not establish the editor's 4/16 ms
budgets or browser performance. No production modules import the spike, so it adds no entry
or editor bundle code.
