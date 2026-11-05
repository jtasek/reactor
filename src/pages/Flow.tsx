import { ArrowLeft, Play, Undo2, Redo2, X } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { registerEditor } from './registerEditor';
import React, { useEffect, useRef, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { projectFlow, reachableScreens } from 'src/app/flowProjection';
import { ComponentInteractions } from 'src/ui/components/Inspector/ComponentInteractions';
import { isReadOnly } from 'src/app/documentAccess';
import { FlowDiagram } from './FlowDiagram';
import styles from './Flow.css';

registerEditor();

export function FlowPage() {
    const graph = useAppState((state) => projectFlow(state.currentDocument));
    const documentId = useAppState((state) => state.currentDocumentId);

    return <FlowWorkspace key={documentId} graph={graph} />;
}

function FlowWorkspace({ graph }: { graph: ReturnType<typeof projectFlow> }) {
    const workspace = useRef<HTMLElement>(null);
    const editor = useRef<HTMLElement>(null);
    const [selected, setSelected] = useState<string>();
    const [advanced, setAdvanced] = useState(false);
    const [start, setStart] = useState<string>();
    const { editInteractions } = useActions();
    const effects = useEffects();
    const document = useAppState((state) => state.currentDocument);
    const disabled = useAppState(
        (state) =>
            isReadOnly(state) ||
            state.currentDocument.locked ||
            state.events.pointer.gesture.kind !== 'idle'
    );
    const control = graph
        .flatMap((screen) => screen.controls)
        .find((item) => item.key === selected);
    const reachable = reachableScreens(graph, start);
    const canUndo = !disabled && document.history.canUndo;
    const canRedo = !disabled && document.history.canRedo;
    useEffect(() => {
        // The editor sits under the diagram; bring it into view without moving focus.
        if (selected) {
            editor.current?.scrollIntoView?.({ block: 'nearest' });
        }
    }, [selected]);
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

    return (
        <main ref={workspace} className={styles.flow}>
            <header>
                <a href="/" aria-label="Back to canvas">
                    <Icon icon={{ component: ArrowLeft, size: 18 }} />
                    Canvas
                </a>
                <h1>Flow</h1>
                <span className={styles.documentName}>{document.name}</span>
                <a
                    aria-label="Play prototype"
                    href={`/prototype${start ? `?screen=${encodeURIComponent(start)}` : ''}`}
                >
                    <Icon icon={{ component: Play, size: 18 }} />
                    Play
                </a>
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
            </header>
            <label className={styles.start}>
                Start screen{' '}
                <select
                    aria-label="Start screen for reachability"
                    value={start ?? ''}
                    onChange={(event) => setStart(event.target.value || undefined)}
                >
                    <option value="">Choose a screen</option>
                    {graph
                        .filter((screen) => screen.available)
                        .map((screen) => (
                            <option key={screen.id} value={screen.id}>
                                {screen.name}
                            </option>
                        ))}
                </select>
            </label>
            {!graph.length && (
                <p>Create a Screen on the canvas to begin connecting your application.</p>
            )}
            <div className={styles.workspace}>
                <FlowDiagram
                    graph={graph}
                    selected={selected}
                    onSelect={(key) => {
                        setSelected(key);
                        setAdvanced(false);
                    }}
                    start={start}
                    reachable={reachable}
                    canConnect={!disabled && Boolean(control?.editable)}
                    onConnect={(screenId) => {
                        if (!control) {
                            return;
                        }
                        editInteractions({
                            target: 'instance',
                            id: control.instanceId,
                            settings: { activate: { type: 'navigate', screenId } }
                        });
                    }}
                />
                {control && (
                    <aside ref={editor} aria-label="Selected control">
                        <div className={styles.selectionHeader}>
                            <h2>{control.name}</h2>
                            <button
                                aria-label="Deselect control"
                                onClick={() => {
                                    workspace.current
                                        ?.querySelector<HTMLButtonElement>(
                                            `[data-flow-control="${CSS.escape(control.key)}"]`
                                        )
                                        ?.focus();
                                    setSelected(undefined);
                                }}
                            >
                                <Icon icon={{ component: X, size: 18 }} />
                            </button>
                        </div>
                        {control?.shared && (
                            <p>
                                Shared source control. Changes apply everywhere this component is
                                used.
                            </p>
                        )}
                        {control.editable && (
                            <>
                                <ComponentInteractions
                                    instanceId={control.instanceId}
                                    actionOnly={!advanced}
                                />
                                <button
                                    aria-expanded={advanced}
                                    onClick={() => setAdvanced(!advanced)}
                                >
                                    {advanced
                                        ? 'Hide visibility and state'
                                        : 'Visibility and state…'}
                                </button>
                            </>
                        )}
                        {control && !control.editable && (
                            <p>
                                This control is locked or belongs to an imported component. Edit its
                                source to change the action.
                            </p>
                        )}
                    </aside>
                )}
            </div>
            <p className={styles.hint}>
                {control
                    ? 'Use Connect to on a screen, or change the action in the editor.'
                    : 'Select a control to connect it to a screen.'}
            </p>
        </main>
    );
}
