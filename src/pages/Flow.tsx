import { registerEditor } from './registerEditor';
import React, { useEffect, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { projectFlow } from 'src/app/flowProjection';
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
    const [selected, setSelected] = useState<string>();
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
    const reachable = new Set<string>();
    const visit = (id: string) => {
        if (reachable.has(id)) {
            return;
        }
        reachable.add(id);
        const controls = graph.find((screen) => screen.id === id)?.controls ?? [];
        // Preview cannot activate what it never draws.
        const drawn = (item: (typeof controls)[number]) => !item.hidden && !item.unusedVariant;
        // Something that starts hidden counts only when a shown control can reveal it.
        const shown = (item: (typeof controls)[number]) =>
            drawn(item) &&
            (!item.startsHidden ||
                controls.some(
                    (other) =>
                        other.toggleTarget === item.startsHidden &&
                        !other.missing &&
                        !other.startsHidden &&
                        drawn(other)
                ));
        controls.forEach((item) => {
            if (item.target && !item.missing && shown(item)) {
                visit(item.target);
            }
        });
    };
    if (start) {
        visit(start);
    }
    const canUndo = !disabled && document.history.canUndo;
    const canRedo = !disabled && document.history.canRedo;
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
        <main className={styles.flow}>
            <header>
                <a href="/">Back to canvas</a>
                <h1>Flow</h1>
                <a href={`/prototype${start ? `?screen=${encodeURIComponent(start)}` : ''}`}>
                    Open prototype
                </a>
                <button
                    disabled={!canUndo}
                    title="Undo (Ctrl/⌘ Z)"
                    onClick={() => effects.collaboration.undo(document.id)}
                >
                    Undo
                </button>
                <button
                    disabled={!canRedo}
                    title="Redo (Ctrl/⌘ Shift Z)"
                    onClick={() => effects.collaboration.redo(document.id)}
                >
                    Redo
                </button>
            </header>
            <p>
                Select a control, then connect it to a screen. Actions run only in Preview.
                Connections include all authored layouts and variants. Reachability skips hidden
                controls and variants an instance never draws.
            </p>
            <label>
                Check reachability from{' '}
                <select
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
                    onSelect={setSelected}
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
                <aside aria-label="Selected control">
                    <h2>{control?.name ?? 'Select a control'}</h2>
                    {control?.shared && (
                        <p>
                            Shared source control. Changes apply everywhere this component is used.
                        </p>
                    )}
                    {control?.editable && <ComponentInteractions instanceId={control.instanceId} />}
                    {control && !control.editable && (
                        <p>
                            This control is locked or belongs to an imported component. Edit its
                            source to change the action.
                        </p>
                    )}
                </aside>
            </div>
        </main>
    );
}
