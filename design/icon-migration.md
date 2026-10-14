# Reactor Lucide icon migration

Reactor's remaining sprite UI icons now use the installed `lucide-react` 1.55.0. Commands, tools and feature modules import their icons explicitly. The shared `Icon` wrapper handles existing sizes, inherited color, a consistent 1.5 outline stroke and decorative accessibility attributes. The handcrafted `ObjectTypeSymbol` glyphs and the Documents page's existing Lucide icons are unchanged.

## Runtime and loading

Icon components remain in plain command/tool registries and module constants, outside Overmind state and saved documents. Lucide exports are React `forwardRef` objects; storing them in Overmind can proxy their render function and break rendering. A registry regression test renders command/tool icons after actions run and verifies that the store's command table remains empty.

The wrapper has no runtime Lucide import or icon catalogue. Notification text, styles, timers and actions load directly; only their icons load when a notification exists. A rejected icon import resolves to a decorative fallback, with a visible text Dismiss button, so an offline first notification cannot unmount the editor. An unused instance-tool re-export was removed from the registry helper barrel: its new `CopyPlus` import otherwise pulled Lucide into startup. Final webpack statistics contain no Lucide modules in initial chunks. Editor icons load with the editor; Library, Variables and Guides retain their optional loading boundaries. No package upgrade or webpack budget change was needed.

Only the sprite-specific forced fill/stroke rules in ItemMenu and Notification were removed. Layer highlighting retains the active filled star and inactive outlined star. Sizes, color tokens, labels, tooltips, shortcuts and control states retain their existing values. The ControlPanel eye descriptor is now passed through the wrapper correctly.

## Semantic mapping

All named exports were verified against the installed package. Repeated consumers share these mappings; a reused sprite sometimes maps to different Lucide exports where its actions have different meanings. No new custom glyph was required.

| Previous sprite group/name | Lucide export | Meaning and consumers |
| --- | --- | --- |
| `content/content_copy` | `Copy` | Copy, Clone, Library copy |
| `content/content_copy` | `Unlink` | Detach instance |
| `content/content_cut` | `Scissors` | Cut |
| `content/content_paste` | `ClipboardPaste` | Paste |
| `action/delete` | `Trash2` | Delete, Reset document, delete layer |
| `content/add` | `Component` | Create component |
| `content/add` | `LayersPlus` | New empty layer |
| `content/add_box` | `SquarePlus` | Place instance in Library, Explorer and Inspector |
| `content/add_circle` | `CirclePlus` | Add source shapes, expose property |
| `content/remove_circle` | `CircleMinus` | Remove source shapes, stop exposing property |
| `content/remove_circle_outline` | `CircleMinus` | Remove from group |
| `action/find_in_page` | `FileSearch` | Select or find component source |
| `action/restore` | `RotateCcw` | Reset component overrides or individual instance property |
| `action/update` | `RefreshCw` | Apply Library update |
| `action/flip_to_front` | `BringToFront` | Bring selection forward |
| `action/flip_to_back` | `SendToBack` | Send selection backward |
| `av/library_add` | `Group` | Group |
| `av/library_books` | `Ungroup` | Ungroup |
| `content/library_add` | `CopyPlus` | Insert instance tool, distinct from component source |
| `action/tab` | `Layers` | Move selection to a new layer |
| `action/tab_unselected` | `LayersMinus` | Remove selection from its layer |
| `action/visibility` | `Eye` | Visible state, Hide toggle, Show all command |
| `action/visibility_off` | `EyeOff` | Hidden state, Show toggle, Hide command |
| `action/lock`, `action/lock_outline` | `Lock` | Locked state, Unlock toggle, Lock command |
| `action/lock_open` | `LockOpen` | Unlocked state, Lock toggle, Unlock command |
| `action/zoom_in` | `ZoomIn` | Zoom in |
| `action/zoom_out` | `ZoomOut` | Zoom out |
| `action/youtube_searched_for` | `RotateCcw` | Reset zoom to 100% |
| `action/pan_tool` | `MousePointer2` | Select tool |
| `action/open_with` | `Move` | Move tool |
| `action/timeline` | `Slash` | Line tool |
| `content/create` | `PenTool` | Pen tool |
| `image/crop_square` | `RectangleHorizontal` | Rectangle tool |
| `image/crop_square` | `Square` | Draw shape submenu |
| `image/panorama_fish_eye` | `Circle`, `Ellipse` | Distinct circle and ellipse tools |
| `editor/title` | `Type` | Text tool |
| `image/image` | `Image` | Image tool |
| `file/folder_open` | `FolderOpen` | Documents navigation |
| `action/view_list` | `ListTree` | Explorer panel toggle |
| `image/collections_bookmark` | `LibraryBig` | Library panel toggle |
| `image/tune` | `SlidersHorizontal` | Inspector panel toggle |
| `navigation/more_horiz` | `Ellipsis` | More panels, Inspector actions |
| `action/view_agenda` | `Layers` | Move-to-layer submenu and destinations |
| `image/edit` | `Pencil` | Context-menu rename |
| `editor/format_align_left` | `AlignStartVertical` | Align left edges |
| `editor/format_align_left` | `AlignStartHorizontal` | Generic Align submenu |
| `editor/format_align_center` | `AlignCenterVertical` | Align horizontal centers |
| `editor/format_align_right` | `AlignEndVertical` | Align right edges |
| `editor/vertical_align_top` | `AlignStartHorizontal` | Align top edges |
| `editor/vertical_align_center` | `AlignCenterHorizontal` | Align vertical centers |
| `editor/vertical_align_bottom` | `AlignEndHorizontal` | Align bottom edges |
| `reactor/space_between_horizontal` | `AlignHorizontalSpaceBetween` | Equal horizontal gaps |
| `reactor/space_between_vertical` | `AlignVerticalSpaceBetween` | Equal vertical gaps |
| `reactor/space_centers_horizontal` | `AlignHorizontalDistributeCenter` | Equal horizontal center distances |
| `reactor/space_centers_vertical` | `AlignVerticalDistributeCenter` | Equal vertical center distances |
| `toggle/star` | `Star` | Highlight layer, active Explorer toggle filled |
| `toggle/star_border` | `Star` | Inactive Explorer toggle outlined |
| `navigation/arrow_back` | `ArrowLeft` | Leave component source |
| `navigation/chevron_left` | `ChevronLeft` | Menu Back, source breadcrumb |
| `navigation/chevron_right` | `ChevronRight` | Menu More |
| `navigation/close` | `X` | Dismiss notification |
| `action/help` | `CircleHelp` | Command/menu fallback |
| `action/info` | `Info` | Information notification |
| `action/check_circle` | `CircleCheck` | Success notification |
| `alert/warning` | `TriangleAlert` | Warning notification |
| `alert/error` | `CircleAlert` | Error notification |
| `image/grid_on` | `Grid2X2` | Show grid |
| `image/straighten` | `Ruler` | Show guides |
| `editor/border_top` | `RulerDimensionLine` | Show rulers |
| `reactor/component` | `Component` | Component-source navigation marker |

Visibility and locking mappings apply to Inspector, Explorer item menus, selection menus, LayerPanel, GroupPanel and controls. Toggle icons describe the current state, while their accessible labels name the next action. Property exposure switches between plus and minus. Alignment glyph geometry was inspected: the selected start/center/end families depict shared edges and centers; spacing uses separate gap and center-distribution families.

## Production measurements before rebasing

Baseline: clean worktree at `dc64e21957dcde1cc614815297465f8361c32a83`. These before/after measurements isolate the migration on that base, before rebasing onto `dc8f55e9`; the tables preserve the original comparison. Before and after builds use the same dependencies and production configuration. Byte counts below include JavaScript and extracted CSS. Gzip and Brotli are offline compression measurements, not estimates of a running server's Brotli response. Hashed files and individual sizes, plus the subsequent rebased build, are preserved in [icon-migration-measurements.json](icon-migration-measurements.json).

| Asset group | Before raw / gzip / Brotli bytes | After raw / gzip / Brotli bytes |
| --- | ---: | ---: |
| Production entry, all initial assets | 502,573 / 143,823 / 121,249 | 501,530 / 143,407 / 120,922 |
| Editor shared UI and CSS | 273,422 / 65,379 / 56,048 | 266,369 / 63,294 / 54,180 |
| Editor page and CSS | 34,469 / 5,510 / 4,711 | 37,325 / 6,667 / 5,689 |
| Shared async vendor icons | Included in editor shared UI | 21,643 / 6,135 / 5,290 |
| Notification icons | Included in entry | 4,810 / 2,163 / 1,962 |
| Library and CSS | 3,536 / 1,509 / 1,284 | 3,506 / 1,500 / 1,279 |
| Documents page adapter | 244 / 197 / 164 | 244 / 196 / 163 |
| All emitted JavaScript and CSS | 985,925 / 269,125 / 230,596 | 1,007,108 / 276,069 / 236,625 |
| Largest individual file | 239,713 / 60,201 / 49,057 | 238,621 / 59,750 / 48,720 |

The measured entry before rebasing is 489.78 KiB, below the unchanged 491 KiB cap; the largest file is 233.03 KiB, below 248 KiB. There are no webpack errors or warnings. The extra icons have a real bundle cost: all emitted compressed assets grow by 6,944 gzip bytes, although startup becomes smaller and the measured cold flow transfers less overall. The initial eager-notification-icons build exceeded the entry budget; loading only those icons when needed and removing the instance-tool barrel export resolved it without changing budgets. Notification text and styles remain in the entry.

Network measurements use an isolated Chromium context at 1440×1000, without throttling. The cold flow opens Documents, then the editor with Tool Bar, Inspector and Explorer, draws and selects three rectangles, and opens a context menu. Notices are marked as previously shown for this flow; the notification icon chunk's cost appears in the asset table. The warm flow reloads the editor in the same context and HTTP cache. Transfer counts use Chrome's encoded network bytes, including response overhead.

| Observed network measurement | Before | After |
| --- | ---: | ---: |
| Cold sprite requests reaching network | 9 | 0 |
| Cold sprite transfer bytes | 56,747 | 0 |
| Cold JavaScript and CSS transfer bytes | 263,361 | 269,159 |
| Cold code plus icon transfer bytes | 320,108 | 269,159 |
| Warm sprite resource references | 8 cached | 0 |
| Warm sprite network requests / transfer bytes | 0 / 0 | 0 / 0 |
| Warm code plus icon transfer bytes | 1,874 | 1,874 |

Inline Lucide icons travel inside the listed JavaScript chunks; zero separate icon requests does not mean zero icon transfer cost. The representative cold flow saves 50,949 bytes overall. These results describe this flow, rather than every possible optional-feature combination.

Fifteen More-panels menu samples measured a click through two animation frames. The median was 32.2 ms before and 32.3 ms after, with final samples ranging from 19.5 to 33.4 ms. This frame-bound check shows no observed material regression; it does not establish a speed improvement or replace a large-document performance profile.

## Visual and behavioral verification before rebasing

Production captures were inspected for Documents at 1440, 700 and 360 pixels; editor command/tool bars, Inspector alignment/spacing, selection/context menus and Explorer at 1440 and 700 pixels; and a real first-use notification at 1440, 700 and 360 pixels. Icons are visible, outlined and inherit control colors. Documents and notices fit narrow widths. Existing floating panels can overlap bars at 700 pixels; inspection also covered the bars with the obstructing panels moved or hidden. Panel placement was kept unchanged.

The inspected flows made no sprite requests and rendered no sprite `<use>` elements. They produced no page exceptions or failed network requests. The signed-out server returned its existing `/api/auth/get-session` 404. Reset-document confirmation, alignment/spacing behavior, accessible labels and notification dismissal retain browser coverage. New assertions check visible decorative icons, distinct spacing glyphs and inherited notification stroke without forced fill. A clipboard regression blocks new scripts after editor startup, waits for an actual failed request, and verifies that the first error notice remains readable and dismissible while drawing still works without a page exception.

The lint baseline gate, CSS lint, application/test/server type-checks, all 79 unit/server test files with 846 tests and all 202 browser tests pass. The focused clipboard and notice browser run also passes all nine tests, including the unavailable-icon regression. Unit/server and full browser suites run separately with two workers after concurrent full-suite runs hit unrelated timeouts; both reruns pass without changing timeouts or repository test configuration. Browser verification uses a temporary configuration against the production server at port 4187 because the normal test port is occupied by another process. The existing two recorded lint findings remain outside touched files; there are no unresolved test failures. `git diff --check` passes.

## Verification on current master

The PR branch is rebased onto `dc8f55e949328ba919c6a939fba5cbf9bcde6840`. The single conflict in `tests/registerEditor.test.ts` retains both the upstream editor-readiness check and the migration's icon-rendering check; all four tests in that file pass. The rebased production entry is 489,849 bytes (478.37 KiB), 140,889 gzip bytes or 118,846 Brotli bytes. Its largest file is 230,504 bytes (225.10 KiB). Both existing budgets pass with no webpack errors or warnings. These build sizes also include upstream startup-loading improvements and are separate from the icon-only comparison above.

On the rebased branch, application/test/server type-checks, the lint baseline gate, CSS lint, all 849 unit/server tests and all 202 browser tests pass. The complete suites run separately with two workers; browser tests use the same isolated production server on port 4187. No repository test configuration or timeout was changed.

## Asset and license cleanup

All 79 unused `svg-sprite-*` SVG, HTML and CSS files were removed after active references were migrated. Other artwork and its license remain in `static/icons`; the `/icons` route is retained for those assets. The complete installed Lucide ISC and Feather-derived MIT notices are retained in [lucide.LICENSE.txt](../static/icons/lucide.LICENSE.txt), shipped with the existing static directory. Design-token asset metadata now points to Lucide; token values are unchanged.

The external Claude design artifact could not be opened because automatic approval review rejected access to that destination. The migration uses the checked-in design guidance and tokens.
