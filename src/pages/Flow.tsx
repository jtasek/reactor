import { ArrowLeft, Play, Undo2, Redo2 } from 'lucide-react';
import { json } from 'overmind';
import { Icon } from 'src/ui/components/Icon';
import { registerEditor } from './registerEditor';
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
    useActions,
    useAppState,
    useEffects,
    useReaction,
    useVariableContext
} from 'src/app/hooks';
import { flowMachine } from 'src/app/flowMachine';
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
import { FlowLinkMenu } from './FlowLinkMenu';
import { readFlowPositions } from './flowPositions';
import styles from './Flow.css';

registerEditor();

/** How long edits pause before the pictures are drawn again. */
const REDRAW_AFTER_MS = 150;
const DRAWN_FROM = ['shapes', 'frames', 'components', 'variables', 'dimensions'] as const;

type Menu =
    | { kind: 'link'; key: string; at: Point }
    | { kind: 'add'; screenId: string; at: Point }
    | { kind: 'screen'; screenId: string; at: Point };

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
    const { editFrame } = useActions();
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
    const move = (id: string, by: Point, done: boolean) => {
        const origin = (dragStart.current ??= offsets[id] ?? { x: 0, y: 0 });
        const next = { ...offsets, [id]: { x: origin.x + by.x, y: origin.y + by.y } };
        setOffsets(next);
        if (done) {
            dragStart.current = undefined;
            try {
                effects.saveState(storageKey, next);
                setSaveFailed(false);
            } catch {
                setSaveFailed(true);
            }
        }
    };

    // The last automatic layout, so a new link moves only the Screens it has to.
    const base = useRef<FlowLayout | undefined>(undefined);
    const shape = JSON.stringify(
        machine.states.map((state) => [
            state.id,
            state.transitions.map((transition) =>
                transition.effect.kind === 'go' ? transition.effect.to : ''
            )
        ])
    );
    const laidOut = useMemo(
        () => (base.current = layoutFlow(machine, base.current)),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` is the machine's outline.
        [shape, machine.initial]
    );
    const layout = useMemo(() => offsetLayout(laidOut, offsets), [laidOut, offsets]);
    const links = routeLinks(machine, layout);

    const revision = useRevision(document.id, DRAWN_FROM);
    const pictures = useMemo(() => {
        // A plain copy: drawing reads every shape, and tracked reads cost several times more.
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
    }, [revision, document.id, simulation]);

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
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [canUndo, canRedo, effects, document.id]);

    // Idle controls are never shared ones: those gain an action only at their source.
    const controls = machine.states.flatMap((state) => [
        ...state.transitions.map((control) => ({ ...control, screenId: state.id })),
        ...state.idle.map((control) => ({ ...control, screenId: state.id, shared: false }))
    ]);
    const control = (key: string) => controls.find((item) => item.key === key);
    const focusRow = (key: string) =>
        workspace.current
            ?.querySelector<HTMLElement>(`[data-flow-control="${CSS.escape(key)}"]`)
            ?.focus({ preventScroll: true });
    // Play opens on the start screen, or on the Screen that is selected.
    const playFrom = selection?.kind === 'screen' ? selection.id : undefined;
    const linkCount = machine.states.reduce((sum, state) => sum + state.transitions.length, 0);
    const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;
    const menuScreen = machine.states.find(
        (state) => menu && menu.kind !== 'link' && state.id === menu.screenId
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
                  }
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
                <a
                    className={styles.play}
                    aria-label="Play prototype"
                    href={`/prototype${playFrom ? `?screen=${encodeURIComponent(playFrom)}` : ''}`}
                >
                    <Icon icon={{ component: Play, size: 16 }} />
                    Play
                </a>
            </header>
            {saveFailed && (
                <p role="status" className={styles.notice}>
                    Arrangement could not be saved on this device.
                </p>
            )}
            {machine.states.length === 0 ? (
                <p className={styles.empty}>
                    Create a Screen on the canvas to begin connecting your application.
                </p>
            ) : (
                <FlowBoard
                    machine={machine}
                    layout={layout}
                    links={links}
                    document={pictures.document}
                    drawings={pictures.drawings}
                    selection={selection}
                    canArrange
                    onSelect={setSelection}
                    onMove={move}
                    onLinkMenu={(key, at) => {
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
                    onClose={() => {
                        setMenu(undefined);
                        focusRow(menu.key);
                    }}
                />
            )}
            {menu && menu.kind !== 'link' && menuScreen && (
                <ExplorerMenu
                    label={
                        menu.kind === 'add'
                            ? `Add link on ${menuScreen.name}`
                            : `Screen ${menuScreen.name}`
                    }
                    position={menu.at}
                    items={menu.kind === 'add' ? addItems() : screenItems()}
                    onClose={() => setMenu(undefined)}
                />
            )}
        </main>
    );
}
