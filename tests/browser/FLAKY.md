# Known flaky browser tests

Each test here fails sometimes without a code change. It has an owner, who finds the cause, and a
date by which it is fixed or rewritten. A test leaves this list in the change that fixes it; a new
one joins only with a failure seen on master, not on a branch. CI retries each failing test once,
which hides these: do not count on that retry for anything else.

Owner "maintainer" is whoever maintains the codebase (today the project's Claude threads).

| Test | Seen | What fails | Owner | Fix by |
| --- | --- | --- | --- | --- |
| `basicShapes.spec.ts:32` image, both variants | 2026-11-16, 2 of 16 runs on master | Pressing `i` sometimes opens no file chooser, so the test waits 30 s; focus is on the More panels button at that moment. Waiting for the toolbar does not help. | maintainer | 2026-11-23 |
| `screenExport.spec.ts:9` | Every run in the cloud sessions' Chromium, since 2026-11 | The download is named `download` instead of `Home · Mobile.svg`; passes in CI. Likely the non-ASCII file name with that Chromium build. | maintainer | 2026-11-23 |
| `colorEditor.spec.ts:7` | 2026-11-16, under 4 workers | Fails under load, passes alone (3 of 3). | maintainer | 2026-11-27 |
| `contextualLayout.spec.ts:140` | 2026-11-16, under 4 workers | Fails under load, passes alone (3 of 3). | maintainer | 2026-11-27 |
| `inheritedModes.spec.ts` "persists authored view choices…" | 2026-11 reviews, under load | Fails under load, passes on rerun. | maintainer | 2026-11-30 |
| `preview.spec.ts:8` | CI, 2026-11-10 and earlier | Fails once under CI load, then passes. | maintainer | 2026-11-30 |
| Explorer row-menu test | Earlier reviews (#357 to #507) | Named only as "the Explorer item-menu test"; not reproduced on 2026-11-16. The next failure pins it to a line here. | maintainer | 2026-11-30 |

The nightly WebKit run (`.github/workflows/nightly.yml`) will add its own: a test that fails only
in WebKit is a bug in the app or the test, not flakiness, and goes here only once it is seen to
pass and fail on the same commit.
