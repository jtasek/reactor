import { ArrowLeft, Play, Undo2, Redo2 } from 'lucide-react';
import { json } from 'overmind';
import { Icon } from 'src/ui/components/Icon';
import { registerEditor } from './registerEditor';
import React, { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
    useActions,
    useAppState,
    useEffects,
    useReaction,
    useVariableContext
} from 'src/app/hooks';
import { flowMachine, sentence, type FlowRef } from 'src/app/flowMachine';
import { layoutFlow, offsetLayout, routeLinks, type FlowLayout } from 'src/app/flowLayout';
import { isReadOnly } from 'src/app/documentAccess';
import type { Document, Point } from 'src/app/types';
import {
    drawingDocument,
    drawScreen,
    type ScreenDrawing
} from 'src/ui/components/DocumentList/DocumentThumbnail';
import { ExplorerMenu, type ExplorerMenuItem } from 'src/ui/components/Explorer/ExplorerMenu';
import { FlowBoard, type FlowSelection } from './FlowBoard';
import { FlowCheck } from './FlowCheck';
import { FlowLinkMenu } from './FlowLinkMenu';
import { FlowList } from './FlowList';
import { readFlowPositions } from './flowPositions';
import styles from './Flow.css';

registerEditor();

/** How long edits pause before the pictures are drawn again. */
const REDRAW_AFTER_MS = 150;
const DRAWN_FROM = ['shapes', 'frames', 'components', 'variables', 'dimensions'] as const;

type Menu =
    | { kind: 'link'; key: string; at: Point }
    | { kind: 'add'; screenId: string; at: Point }
    | { kind: 'screen'; screenId: string; at: Point }
    | { kind: 'board'; at: Point };

/** Below this the map gives way to a list. */
const NARROW = '(max-width: 699px)';

function useNarrow() {
    const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);

    useEffect(() => {
        const media = window.matchMedia(NARROW);
        const update = () => setNarrow(media.matches);
        update();
        media.addEventListener('change', update);

        return () => media.removeEventListener('change', update);
    }, []);

    return narrow;
}

/** A row on a card, to give focus back to. */
type Place = { key: string; screenId: string };

/** Focuses a row, or its card's Add link once the row is gone. */
function focusPlace(root: HTMLElement | null, place: Place) {
    (
        root?.querySelector<HTMLElement>(`[data-flow-control="${CSS.escape(place.key)}"]`) ??
        root?.querySelector<HTMLElement>(`[data-flow-add="${CSS.escape(place.screenId)}"]`)
    )?.focus({ preventScroll: true });
}

export function FlowPage() {
    const documentId = useAppState((state) => state.currentDocumentId);

    return <FlowWorkspace key={documentId} />;
}

/**
 * A number that changes when the document does: at once for all of it, or, given `parts`,
 * once edits to those have paused.
 */
function useRevision(documentId: string, parts?: readonly (keyof Document)[]) {
    const reaction = useReaction();
    const [revision, next] = useReducer((count: number) => count + 1, 0);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(next, REDRAW_AFTER_MS);
        };
        const stops = parts
            ? parts.map((key) =>
                  reaction((state) => state.documents[documentId]?.[key], schedule, {
                      nested: true
                  })
              )
            : [reaction((state) => state.documents[documentId], next, { nested: true })];

        return () => {
            clearTimeout(timer);
            stops.forEach((stop) => stop());
        };
    }, [reaction, documentId, parts]);

    return revision;
}

function FlowWorkspace() {
    const workspace = useRef<HTMLElement>(null);
    const [selection, setSelection] = useState<FlowSelection>();
    const [menu, setMenu] = useState<Menu>();
    const narrow = useNarrow();
    // Set by the map: brings a Screen's card into view.
    const reveal = useRef<((screenId: string) => void) | undefined>(undefined);
    const { editFrame, editInteractions } = useActions();
    const effects = useEffects();
    const document = useAppState((state) => state.currentDocument);
    // Read once per edit, not once per render: a drag renders every frame.
    const edited = useRevision(document.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `edited` stands for the document.
    const machine = useMemo(() => flowMachine(document), [edited, document.id]);
    const simulation = useVariableContext(document.id);
    const disabled = useAppState(
        (state) =>
            isReadOnly(state) ||
            state.currentDocument.locked ||
            state.events.pointer.gesture.kind !== 'idle'
    );
    const canUndo = !disabled && document.history.canUndo;
    const canRedo = !disabled && document.history.canRedo;

    // Device-local arrangement, apart from the shared document and canvas positions.
    const storageKey = `reactor:flow:${document.id}`;
    const [offsets, setOffsets] = useState<Record<string, Point>>(() => {
        try {
            return readFlowPositions(effects.loadState(storageKey));
        } catch {
            return {};
        }
    });
    const [saveFailed, setSaveFailed] = useState(false);
    const dragStart = useRef<Point | undefined>(undefined);
    const keep = (next: Record<string, Point>) => {
        setOffsets(next);
        try {
            effects.saveState(storageKey, next);
            setSaveFailed(false);
        } catch {
            setSaveFailed(true);
        }
    };
    const move = (id: string, by: Point, done: boolean) => {
        const origin = (dragStart.current ??= offsets[id] ?? { x: 0, y: 0 });
        const next = { ...offsets, [id]: { x: origin.x + by.x, y: origin.y + by.y } };
        if (done) {
            dragStart.current = undefined;
            keep(next);
        } else {
            setOffsets(next);
        }
    };

    // The last automatic layout, so a new link moves only the Screens it has to.
    const base = useRef<FlowLayout | undefined>(undefined);
    const shape = JSON.stringify(
        machine.states.map((state) => [
            state.id,
            state.reachable,
            state.transitions.map((transition) =>
                transition.effect.kind === 'go' && !transition.inactive ? transition.effect.to : ''
            )
        ])
    );
    // Counts each Tidy up, which starts the layout over.
    const [tidied, tidy] = useReducer((count: number) => count + 1, 0);
    const laidOut = useMemo(
        () => (base.current = layoutFlow(machine, base.current)),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` is the machine's outline.
        [shape, machine.initial, tidied]
    );
    // A Screen someone moved stays where they put it, whatever the layout under it does.
    const under = useRef(laidOut);
    useLayoutEffect(() => {
        const before = new Map(under.current.cards.map((card) => [card.id, card]));
        under.current = laidOut;
        let next: Record<string, Point> | undefined;
        for (const card of laidOut.cards) {
            const was = before.get(card.id);
            const offset = offsets[card.id];
            if (was && offset && (was.x !== card.x || was.y !== card.y)) {
                next = {
                    ...(next ?? offsets),
                    [card.id]: { x: offset.x + was.x - card.x, y: offset.y + was.y - card.y }
                };
            }
        }
        if (next) {
            keep(next);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the layout changes.
    }, [laidOut]);
    // Tidy up has something to do: a Screen was moved, or the layout kept gaps to stay still.
    const canTidy = useMemo(() => {
        const fresh = new Map(layoutFlow(machine).cards.map((card) => [card.id, card]));

        return (
            Object.keys(offsets).some((id) => fresh.has(id)) ||
            laidOut.cards.some((card) => {
                const clean = fresh.get(card.id);

                return clean?.x !== card.x || clean.y !== card.y;
            })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `laidOut` follows the machine.
    }, [laidOut, offsets]);
    const layout = useMemo(() => offsetLayout(laidOut, offsets), [laidOut, offsets]);
    const links = routeLinks(machine, layout);

    const revision = useRevision(document.id, DRAWN_FROM);
    const pictures = useMemo(() => {
        if (narrow) {
            // The list shows no pictures.
            return { document, drawings: new Map<string, ScreenDrawing>() };
        }
        // Untracked: drawing reads every shape, and tracked reads cost several times more.
        const plain = json(document);
        const drawn = drawingDocument(plain, simulation);
        const drawings = new Map<string, ScreenDrawing>();
        for (const state of machine.states) {
            const drawing = drawScreen(plain, drawn, state.id, simulation);
            if (drawing) {
                drawings.set(state.id, drawing);
            }
        }

        return { document: drawn, drawings };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- drawn again when edits settle.
    }, [revision, document.id, simulation, narrow]);

    useEffect(() => {
        // The designer's shortcuts run only on the canvas page.
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const key = event.key.toLowerCase();
            if (
                !(event.metaKey || event.ctrlKey) ||
                event.altKey ||
                (key !== 'z' && key !== 'y') ||
                target?.closest('input, textarea, select, [contenteditable="true"]')
            ) {
                return;
            }
            event.preventDefault();
            const redo = key === 'y' || event.shiftKey;
            if (redo && canRedo) {
                effects.collaboration.redo(document.id);
            } else if (!redo && canUndo) {
                effects.collaboration.undo(document.id);
            }
        };
        // Capturing, so undo works while a link menu, which keeps its keys to itself, is open.
        window.addEventListener('keydown', onKeyDown, true);

        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [canUndo, canRedo, effects, document.id]);

    const selected = selection !== undefined;
    useEffect(() => {
        if (!selected) {
            return;
        }
        // Menus and popovers keep their Escape to themselves, so one that gets here deselects.
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
                setSelection(undefined);
            }
        };
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selected]);

    // Idle controls are never shared ones: those gain an action only at their source.
    const controls = machine.states.flatMap((state) => [
        ...state.transitions.map((control) => ({ ...control, screenId: state.id })),
        ...state.idle.map((control) => ({ ...control, screenId: state.id, shared: false }))
    ]);
    const control = (key: string) => controls.find((item) => item.key === key);
    // Where focus goes back to when a menu closes: its row, or, once the row is gone, its card.
    const returnTo = useRef<Place | undefined>(undefined);
    const focusRow = (place: Place) => focusPlace(workspace.current, place);
    useEffect(() => {
        const place = returnTo.current;
        returnTo.current = undefined;
        const active = window.document.activeElement;
        if (place && (!active || active === window.document.body)) {
            focusPlace(workspace.current, place);
        }
    }, [machine]);
    // ⌫ on a row removes its link; focus moves to the card's Add link once the row is gone.
    const remove = (key: string) => {
        const link = control(key);
        if (!link || disabled || !link.editable || link.shared) {
            return;
        }
        returnTo.current = { key, screenId: link.screenId };
        editInteractions({
            target: 'instance',
            id: link.instanceId,
            settings: { activate: null }
        });
    };
    // Selects what a remark is about, brings it into view and puts the keyboard on it.
    const show = (ref: FlowRef) => {
        setSelection(
            ref.key ? { kind: 'link', key: ref.key } : { kind: 'screen', id: ref.screenId }
        );
        reveal.current?.(ref.screenId);
        const screen = workspace.current?.querySelector<HTMLElement>(
            `[data-flow-screen="${CSS.escape(ref.screenId)}"]`
        );
        (
            (ref.key
                ? screen?.querySelector<HTMLElement>(`[data-flow-control="${CSS.escape(ref.key)}"]`)
                : undefined) ?? screen?.querySelector<HTMLElement>('[data-flow-stop]')
        )?.focus({ preventScroll: !narrow });
    };
    // What changed, said aloud: a link added, changed or removed, by anyone.
    const [announcement, setAnnouncement] = useState('');
    const said = useRef<Map<string, string> | undefined>(undefined);
    useEffect(() => {
        const now = new Map(
            machine.states.flatMap((state) =>
                state.transitions.map((link) => [link.key, sentence(link)] as const)
            )
        );
        const before = said.current;
        said.current = now;
        if (!before) {
            return;
        }
        const lines: string[] = [];
        for (const [key, text] of now) {
            if (before.get(key) !== text) {
                lines.push(`${before.has(key) ? 'Link changed' : 'Link added'}: ${text}`);
            }
        }
        for (const [key, text] of before) {
            if (!now.has(key)) {
                lines.push(`Link removed: ${text}`);
            }
        }
        if (lines.length > 0) {
            // A renamed Screen changes many sentences at once; a few say enough.
            setAnnouncement(lines.slice(0, 3).join('. '));
        }
    }, [machine]);
    // Screens as the map lays them out: by column, then down each column.
    const order = useMemo(
        () => [...laidOut.cards].sort((a, b) => a.x - b.x || a.y - b.y).map((card) => card.id),
        [laidOut]
    );
    const tidyUp = () => {
        base.current = undefined;
        keep({});
        tidy();
    };
    // Play opens on the start screen, or on the Screen that is selected.
    const playFrom = selection?.kind === 'screen' ? selection.id : undefined;
    const linkCount = machine.states.reduce((sum, state) => sum + state.transitions.length, 0);
    const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;
    const menuScreen = machine.states.find(
        (state) => menu && 'screenId' in menu && state.id === menu.screenId
    );
    const menuControl = menu?.kind === 'link' ? control(menu.key) : undefined;
    const screenItems = (): ExplorerMenuItem[] =>
        menuScreen
            ? [
                  {
                      id: 'start',
                      label: 'Start here',
                      checked: machine.initial === menuScreen.id,
                      disabled:
                          disabled || !menuScreen.available || machine.initial === menuScreen.id,
                      onRun: () => editFrame({ kind: 'start', id: menuScreen.id })
                  },
                  {
                      id: 'play',
                      label: 'Play from here',
                      disabled: !menuScreen.available,
                      onRun: () =>
                          effects.navigate(`/prototype?screen=${encodeURIComponent(menuScreen.id)}`)
                  },
                  // The board's right-click menu has it too; this one the keyboard reaches.
                  ...(canTidy && !narrow
                      ? ['separator' as const, { id: 'tidy', label: 'Tidy up', onRun: tidyUp }]
                      : [])
              ]
            : [];
    const addItems = (): ExplorerMenuItem[] =>
        menuScreen && menu
            ? menuScreen.idle.length > 0
                ? [
                      { heading: 'Add a link from' },
                      ...menuScreen.idle.map(
                          (item): ExplorerMenuItem => ({
                              id: item.key,
                              label: item.control,
                              disabled: disabled || !item.editable,
                              keepOpen: true,
                              onRun: () => setMenu({ kind: 'link', key: item.key, at: menu.at })
                          })
                      )
                  ]
                : [{ heading: 'Every control here has a link' }]
            : [];

    return (
        <main ref={workspace} className={styles.flow}>
            <header className={styles.toolbar}>
                <a href="/" aria-label="Back to canvas">
                    <Icon icon={{ component: ArrowLeft, size: 18 }} />
                    <span className={styles.canvasLabel}>Canvas</span>
                </a>
                <div className={styles.title}>
                    <span className={styles.documentName}>{document.name}</span>
                    <span className={styles.summary}>
                        <h1>Flow</h1>
                        {machine.states.length > 0 &&
                            ` · ${count(machine.states.length, 'screen')} · ${count(linkCount, 'link')}`}
                    </span>
                </div>
                <div className={styles.history}>
                    <button
                        disabled={!canUndo}
                        aria-label="Undo"
                        title="Undo (Ctrl/⌘ Z)"
                        onClick={() => effects.collaboration.undo(document.id)}
                    >
                        <Icon icon={{ component: Undo2, size: 18 }} />
                    </button>
                    <button
                        disabled={!canRedo}
                        aria-label="Redo"
                        title="Redo (Ctrl/⌘ Shift Z)"
                        onClick={() => effects.collaboration.redo(document.id)}
                    >
                        <Icon icon={{ component: Redo2, size: 18 }} />
                    </button>
                </div>
                {machine.states.length > 0 && (
                    <FlowCheck
                        machine={machine}
                        disabled={disabled}
                        onStart={(id) => editFrame({ kind: 'start', id })}
                        onShow={show}
                        onFix={(ref, at) => {
                            show(ref);
                            setMenu(
                                ref.key
                                    ? { kind: 'link', key: ref.key, at }
                                    : { kind: 'add', screenId: ref.screenId, at }
                            );
                        }}
                    />
                )}
                <a
                    className={styles.play}
                    aria-label="Play prototype"
                    href={`/prototype${playFrom ? `?screen=${encodeURIComponent(playFrom)}` : ''}`}
                >
                    <Icon icon={{ component: Play, size: 16 }} />
                    Play
                </a>
            </header>
            <p role="status" aria-live="polite" className={styles.hidden} data-flow-announce="">
                {announcement}
            </p>
            {saveFailed && (
                <p role="status" className={styles.notice}>
                    Arrangement could not be saved on this device.
                </p>
            )}
            {machine.states.length === 0 ? (
                <p className={styles.empty}>
                    Create a Screen on the canvas to begin connecting your application.
                </p>
            ) : narrow ? (
                <FlowList
                    machine={machine}
                    order={order}
                    selection={selection}
                    canEdit={!disabled}
                    onSelect={setSelection}
                    onRemove={remove}
                    onLinkMenu={(key, at) => {
                        returnTo.current = undefined;
                        setSelection({ kind: 'link', key });
                        setMenu({ kind: 'link', key, at });
                    }}
                    onAddMenu={(screenId, at) => setMenu({ kind: 'add', screenId, at })}
                    onScreenMenu={(screenId, at) => {
                        setSelection({ kind: 'screen', id: screenId });
                        setMenu({ kind: 'screen', screenId, at });
                    }}
                />
            ) : (
                <FlowBoard
                    handle={reveal}
                    onRemove={remove}
                    machine={machine}
                    layout={layout}
                    links={links}
                    document={pictures.document}
                    drawings={pictures.drawings}
                    selection={selection}
                    canArrange
                    canConnect={!disabled}
                    canTidy={canTidy}
                    onConnect={(instanceId, screenId) => {
                        editInteractions({
                            target: 'instance',
                            id: instanceId,
                            settings: { activate: { type: 'navigate', screenId } }
                        });
                        const linked = controls.find((item) => item.instanceId === instanceId);
                        if (linked) {
                            setSelection({ kind: 'link', key: linked.key });
                        }
                    }}
                    onBoardMenu={(at) => setMenu({ kind: 'board', at })}
                    onSelect={setSelection}
                    onMove={move}
                    onLinkMenu={(key, at) => {
                        returnTo.current = undefined;
                        setSelection({ kind: 'link', key });
                        setMenu({ kind: 'link', key, at });
                    }}
                    onAddMenu={(screenId, at) => setMenu({ kind: 'add', screenId, at })}
                    onScreenMenu={(screenId, at) => {
                        setSelection({ kind: 'screen', id: screenId });
                        setMenu({ kind: 'screen', screenId, at });
                    }}
                />
            )}
            {menu?.kind === 'link' && menuControl && (
                <FlowLinkMenu
                    key={menu.key}
                    instanceId={menuControl.instanceId}
                    name={menuControl.control}
                    shared={menuControl.shared}
                    position={menu.at}
                    sheet={narrow}
                    onClose={() => {
                        const place = { key: menu.key, screenId: menuControl.screenId };
                        setMenu(undefined);
                        focusRow(place);
                        // A choice may remove the row: focus follows once the map has changed.
                        returnTo.current = place;
                    }}
                />
            )}
            {menu?.kind === 'board' && (
                <ExplorerMenu
                    label="Board"
                    position={menu.at}
                    items={[
                        {
                            id: 'tidy',
                            label: 'Tidy up',
                            onRun: tidyUp
                        }
                    ]}
                    onClose={() => setMenu(undefined)}
                />
            )}
            {menu && (menu.kind === 'add' || menu.kind === 'screen') && menuScreen && (
                <ExplorerMenu
                    label={
                        menu.kind === 'add'
                            ? `Add link on ${menuScreen.name}`
                            : `Screen ${menuScreen.name}`
                    }
                    position={menu.at}
                    sheet={narrow}
                    items={menu.kind === 'add' ? addItems() : screenItems()}
                    onClose={() => setMenu(undefined)}
                />
            )}
        </main>
    );
}
