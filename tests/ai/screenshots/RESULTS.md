# Template screenshot baseline — 2026-11-02

Provider: local LM Studio, OpenAI-compatible endpoint, `qwen3-vl-8b-instruct`.
One complete serial run: 30 cases, about 15 minutes. The fixtures comprise 12 starter
screens, 12 palette variants and six copy variants; they are correlated synthetic designs.

| Measurement | Observed |
| --- | --- |
| Valid on first attempt | 25/30 (83.3%) |
| Valid after at most one repair | 25/30 (83.3%) |
| All automated structural checks passed | 0/30 |
| Accepted proposals with no artwork parented to the screen | 25/25 |
| First operation p50 | 8.65 s |
| Completion p95 | 40.73 s (target: 20 s) |
| Reported input / output tokens | 239,019 / 13,284 |
| Human usability ratings | Not collected |

All 25 valid proposals created a screen/view but placed their generated artwork outside
its source tree, producing blank screen exports. None of the 40 expected controls in these
accepted cases was reused **inside the screen**. This does not mean the model never created
component instances: some were placed on Canvas without screen membership. The five rejected
proposals ended with variable-name conflicts (three) or invalid variables (two), after repair.
Existing artwork remained unchanged before acceptance; accepted batches passed collaboration,
library preservation and whole-batch undo checks.

The live suite deliberately exits unsuccessfully because its automated checks fail. This is
model-quality evidence, not a passing product-quality gate. Two independent human ratings
are still required by the roadmap. No general screenshot-quality claim follows from this
fixture set. Color diagnostics check authored palette matching/binding using CIE76; they do
not measure pixel-level reproduction of the screenshot.

Run artifacts are saved locally at
`test-results/ai-screenshots-qwen-2026-11-02/`: open `index.html` for paired screenshots,
`report.json` for per-case results, and `ratings.json` for the unfilled review sheet.
Each case retains its supplied prompt/context, reference image and returned proposal;
accepted cases also retain the generated SVG/PNG and document entities. `provenance.json`
records source and reference-image hashes. Generated artifacts are intentionally gitignored.
The suite hash is `e39a651b6c3fed338134c80c85e2f94569d66ccbddad02081644558a3eca24a2`.

The interrupted development run was excluded: its fixture isolation was corrected before
this complete run. Model sampling settings, quantization and hardware were not captured;
latency numbers describe this local run rather than a hardware-independent model benchmark.

The next quality improvement to investigate is screen-generation semantic validation:
require proposed artwork to belong to the requested screen and offer that diagnostic to the
existing repair flow. Do not weaken general operation validation or count detached Canvas
artwork as a successful screenshot recreation. Rerun this same corpus after any change;
broader quality needs an independent screenshot set and human review.


## Rerun after the screen authoring fix — 2026-11-02

Same 30-case suite and model (`qwen3-vl-8b-instruct`), with the complete-screen tool,
explicit geometry schema and screenshot repair checks. One complete serial rerun,
about 18 minutes; exploratory partial runs were excluded.

| Measurement | Before | After |
| --- | --- | --- |
| First-try valid | 25/30 | 15/30 |
| Valid after at most one repair | 25/30 | 21/30 |
| Nonblank generated screen exports | 0/30 | 21/30 |
| Accepted but detached artwork | 25/25 | 0/21 |
| All structural quality checks passed | 0/30 | 0/30 |
| First operation p50 | 8.65 s | 22.02 s |
| Completion p95 | 40.73 s | 84.26 s |
| Human usability ratings | Unrated | Unrated |

The screen/artwork container now expands to existing validated frame/shape operations;
ownership comes from that explicit container, not geometric inference or a repair of stored
documents. A source-call index map keeps repair feedback correct after expansion. The model
receives a screenshot-specific schema with required positions. A raw-provider trace confirmed
that the old responses omitted ownership rather than the renderer dropping it.

All 21 accepted results rendered artwork and passed the existing library-preservation,
collaboration and undo checks. The nine rejected cases comprised seven key collisions,
one gateway failure at its 60-second turn limit, and one incomplete model answer. Remaining
quality failures include unbound palette values, missing/wrong control labels and insufficient
component reuse. Visual differences and omissions remain: nonblank does not mean faithful.
The live quality suite still exits unsuccessfully, and the 20-second completion target is unmet.
Usage totals are unknown because one request returned no usage; do not interpret that as zero.

Artifacts: `test-results/ai-screenshots-qwen-screen-tool-2026-11-02/`. In addition to paired
images, proposal data and the report, each case now retains `provider-events.json`.
The complete-suite hash remains
`e39a651b6c3fed338134c80c85e2f94569d66ccbddad02081644558a3eca24a2`.
A separate diagnostic smoke test used the installed `qwen3.5-4b`; it is not included in this
comparison. No screenshot-quality target is marked complete by this rerun.


## Rerun after shared descriptions and scoped artwork — 2026-11-02

Completed all 30 cases serially against the same local `qwen3-vl-8b-instruct` endpoint
in 17.1 minutes. All reference PNGs and user prompts are byte-for-byte unchanged from
the previous run. Component/variable context and tool instructions changed, as intended;
the full suite hash therefore changed to
`778c55947b9ba1d7039201754624446a685671628d29bea261f3d5e70bcb62bc`.
Source snapshots and hashes are saved with the new run. These are single observations;
sampling settings and quantization were not captured, so differences are not statistical
estimates of model quality.

| Measurement | Previous screen-tool run | Shared-descriptions run |
| --- | --- | --- |
| First-try valid | 15/30 (50%) | 27/30 (90%) |
| Valid after at most one repair | 21/30 (70%) | 27/30 (90%) |
| Nonblank generated exports | 21/30 | 27/30 |
| Final key-collision failures | 7 | 0 |
| All automated quality checks passed | 0/30 | 0/30 |
| Correctly reused labeled controls in accepted outputs | 0/29 | 0/46 |
| Accepted outputs with unbound matching palette colors | 17/21 | 27/27 |
| First operation p50 | 22.02 s | 26.70 s |
| Completion p95 | 84.26 s | 59.09 s |
| Human usability ratings | Unrated | Unrated |

Eight previously rejected cases now produced valid proposals; two previously accepted cases
did not. The three remaining failures were incomplete answers for `list-detail-2-original`
and `list-detail-2-copy`, and a gateway failure at 60 seconds for `settings-1-palette`.
Six of the seven prior key-collision cases became valid; the seventh was the timeout.
No repair converted a failed answer in this run. Usage totals remain unknown because the
failed gateway request did not report usage.

Different acceptance rates change the control and color denominators. On the **19 cases
accepted in both runs**, correctly labeled component reuse remained 0/27 expected controls,
and matching palette fields without bindings increased from 43 to 52. Three of those 19
generated PNGs were byte-identical: `list-detail-1-original`, `forms-1-palette` and
`list-detail-3-copy`. These counts do not measure pixel-level similarity.

Assistant visual inspection covered all 12 original designs in a reference/previous/current
gallery. Fidelity remains poor, with some regressions: the project list still omits an action
and shows the default “Button” label; the sign-in form still omits its main action and uses
“Placeholder”; the request form now renders but misses input boxes and places content
incorrectly. The new `forms-1-original` title clips at the top, and `sign-in-2-original` loses
the previous heading and copy while overlapping a separate label on a generic button.
This inspection does not replace the two independent human reviews required by the roadmap.
Raw provider traces for the inspected list and request-form cases omit instance overrides;
the renderer did not discard supplied labels.

All 27 accepted batches passed the existing pre-acceptance, library-preservation,
collaboration and one-step undo checks. The benchmark **exited unsuccessfully** because no
case passed its combined quality criteria. The result supports improved operation validity,
not improved visual usability; the live quality and latency gates remain open.

New artifacts: `test-results/ai-screenshots-qwen-authoring-2026-11-02/`, also retained outside
Playwright's temporary output directory in `/tmp/reactor-qwen-authoring-rerun-20261102/`.
The persistent local gallery is `reactor-ai-authoring-comparison/index.html` in the chat's
visualizations directory, with all 30 image comparisons, raw events, source snapshots,
`comparison.json` and an unfilled human rating sheet.


## Rerun after semantic screen composition — 2026-11-02

Completed all 30 cases serially with local `qwen3-vl-8b-instruct` in 13.7 minutes.
Reference PNGs and user prompts are unchanged. Context now includes natural component sizes;
the tools and image instructions changed. The complete-suite hash is
`e8334141013021b232c9cdad732cf4b48da66673db8027fb0a81c953ab59aa9b`.
Source snapshots and hashes are retained. Exploratory partial runs are excluded from these
totals; no case in this final run was selectively retried beyond the existing single repair.

`composeScreen` accepts ordered text, explicit button/input roles, actual labels and hints,
padding, gaps and an optional bottom footer. Reactor measures wrapped text, lays out the
column and compiles ordinary frame/shape operations. Unique role candidates can be selected
without an opaque component ID; explicit IDs must match the role. Public property links
supply the actual override IDs. Exact, unambiguous palette matches and explicit color IDs
become bindings. Invalid or overflowing compositions use the existing repair flow. There is
no reference-graph/template lookup, durable schema change or alteration to acceptance.

| Measurement | Previous complete run | Composition run |
| --- | --- | --- |
| First-try valid | 27/30 | 24/30 |
| Valid after at most one repair | 27/30 | 29/30 |
| Nonblank exported screens | 27/30 | 28/30 |
| All automated quality checks passed | 0/30 | 26/30 |
| Correctly reused controls in accepted outputs | 0/46 | 46/50 |
| Unbound matching palette fields in accepted outputs | 90 | 0 |
| First operation p50 | 26.70 s | 23.54 s |
| Completion p95 | 59.09 s | 51.31 s |
| Human usability ratings | Unrated | Unrated |

The control check was strengthened after visual inspection exposed a false positive: a
hidden input label had counted as the text of an expected button. Matches now require the
expected role and, for inputs, the expected hint as well as the label. The previous run had
zero label matches, so it remains zero under the stricter check. Denominators above cover
accepted cases and differ between runs. On the 26 cases accepted in both runs, correct reuse
increased from 0/44 to 40/44 and unbound matching palette fields fell from 88 to zero.
Five initially invalid proposals became valid after repair. All 29 accepted batches passed
the pre-acceptance, library-preservation, collaboration and whole-batch undo checks.

Four cases still fail the live gate:

- `list-detail-1-original`: the first composition selected an input ID for a button; repair
  returned a view referencing a screen that had not been created, so nothing was accepted.
- `sign-in-2-original`: an accepted proposal created extra screen/view structure, leaving no
  eligible single-view export and no matching reused controls.
- `list-detail-1-palette` and `list-detail-1-copy`: the model requested an input where the
  reference has its second button. The exported control shows “Placeholder”; the stricter
  role check correctly refuses to count its hidden label as a button match.

Assistant visual inspection covered the ten passing original screenshots and representative
palette/copy outputs, including both wrong-control failures. Form and settings fields now
show their captions, hints and actual action labels without collisions. Spacing, font sizes
and exact margins still differ. Thirteen outputs repeat the footer in their main content;
the current automated gate does not detect that duplication. No independent human usability
scores have been assigned, and this correlated template corpus does not establish broad
real-world screenshot fidelity.

A separate post-run SVG text diagnostic joins grouped wrapped lines, normalizes whitespace
and compares exact strings and occurrence counts. Across all 30 references, matched exported
text blocks increased from 86/195 to 178/195; failed/unrendered cases count as missing. This
diagnostic is not part of the pass gate and does not measure geometry, typography, contrast
or pixels. Current extras comprise 13 repeated footers, two wrong “Placeholder” controls and
two punctuation substitutions in footer text. Its script and per-case results are archived.

The benchmark exited unsuccessfully because four cases failed; the 20-second p95 target
and human quality gate also remain open. Reported usage was 229,695 input and 10,769 output
tokens. Previous usage was incomplete, so no token-cost comparison is claimed. These are
single observed runs; model sampling, quantization and hardware were not captured.

Verification: 1,913 unit/server tests passed with two workers; all 11 AI browser tests passed,
including composed controls, color bindings and reload. Type-checking, the production build
and lint baseline gate passed. Earlier default-concurrency runs hit five-second timeouts in
storage/collaboration stress tests; both passed in isolation and the bounded full suite.
The final prompt correction was additionally checked by 44 focused tests before the live run.

Artifacts: `test-results/ai-screenshots-qwen-composition-2026-11-02/`, with the original final
run retained at `/tmp/reactor-qwen-composition-final-20261102/`. The persistent gallery is
`reactor-ai-composition-comparison/index.html` in this chat's visualizations directory. It
contains all 30 reference/previous/current comparisons, raw responses, source snapshots,
metrics, text diagnostics, representative comparison images and the unfilled rating sheet.
