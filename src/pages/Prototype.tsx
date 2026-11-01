import { registerEditor } from './registerEditor';
import React, { useEffect, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { screenFrames } from 'src/app/screens';
import { previewModes } from 'src/app/modeEdits';
import { ordered } from 'src/app/variableModes';
import type { PreviewDiagnostic, PreviewSession } from 'src/preview/project';
import InteractivePreview from 'src/ui/components/InteractivePreview/InteractivePreview';
import styles from './Prototype.css';

registerEditor();

export function PrototypePage() {
    const id = useAppState((state) => state.currentDocumentId);

    return <PrototypeWorkspace key={id} />;
}

function ViewportField({
    label,
    value,
    change
}: {
    label: string;
    value: number;
    change: (value: number) => void;
}) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    const commit = () => {
        const number = Number(draft);
        if (Number.isFinite(number) && number >= 1 && number <= 10000) {
            change(number);

            return;
        }
        setDraft(String(value));
    };

    return (
        <label>
            {label}
            <input
                aria-label={`Prototype ${label.toLowerCase()}`}
                type="number"
                min="1"
                max="10000"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
            />
        </label>
    );
}

function PrototypeWorkspace() {
    const document = useAppState((state) => state.currentDocument);
    const seed: PreviewSession = useAppState(previewModes);
    const screens = screenFrames(document);
    const effects = useEffects();
    const actions = useActions();
    const [session, setSession] = useState<PreviewSession>(() => {
        const requested = new URLSearchParams(window.location.search).get('screen');
        const initial =
            screens.find((screen) => screen.id === (requested ?? seed.screenId)) ?? screens[0];
        const fromView = initial?.id === seed.screenId;

        return {
            ...seed,
            screenId: initial?.id,
            modes: fromView ? seed.modes : {},
            layoutId: fromView ? seed.layoutId : undefined,
            layoutMode: fromView ? seed.layoutMode : 'auto',
            viewport: {
                ...(fromView && seed.viewport
                    ? seed.viewport
                    : (initial?.size ?? { width: 390, height: 844 }))
            },
            scope: 'all-screens'
        };
    });
    const [restart, setRestart] = useState(0);
    const reset = () => setRestart((value) => value + 1);
    const resize = (axis: 'width' | 'height', value: number) =>
        setSession((previous) => ({
            ...previous,
            viewport: { ...previous.viewport!, [axis]: value }
        }));
    const locate = ({ kind, id }: PreviewDiagnostic) => {
        effects.navigate('/');
        actions.ui.showControl('inspector');
        if (kind === 'frame') {
            actions.editFrame({ kind: 'select', id });

            return;
        }
        const component = Object.values(document.components).find((source) =>
            source.shapesIds.includes(id)
        );
        if (component && !document.shapes[id]) {
            actions.selectComponentSource(component.id);

            return;
        }
        if (component) {
            actions.selectComponentChild({ componentId: component.id, shapeId: id });

            return;
        }
        if (document.shapes[id]) {
            actions.unselectShapes();
            actions.selectShape(id);
        }
    };

    return (
        <main className={styles.prototype}>
            <header>
                <a href="/">Close prototype</a>
                <h1>Prototype</h1>
                <button onClick={reset} disabled={!screens.length}>
                    Reset prototype
                </button>
            </header>
            <p>
                Viewport and modes apply to this session across navigation. Canvas settings stay
                unchanged.
            </p>
            <section className={styles.controls} aria-label="Prototype settings">
                <label>
                    Start screen
                    <select
                        aria-label="Start screen"
                        value={session.screenId ?? ''}
                        onChange={(event) =>
                            setSession((previous) => ({
                                ...previous,
                                screenId: event.target.value,
                                layoutId: undefined,
                                layoutMode: 'auto'
                            }))
                        }
                    >
                        {!screens.some((screen) => screen.id === session.screenId) && (
                            <option value={session.screenId ?? ''}>
                                Choose an available screen
                            </option>
                        )}
                        {screens.map((screen) => (
                            <option key={screen.id} value={screen.id}>
                                {screen.name}
                            </option>
                        ))}
                    </select>
                </label>
                <ViewportField
                    label="Width"
                    value={session.viewport!.width}
                    change={(value) => resize('width', value)}
                />
                <ViewportField
                    label="Height"
                    value={session.viewport!.height}
                    change={(value) => resize('height', value)}
                />
                {ordered(document.dimensions).map((dimension) => (
                    <label key={dimension.id}>
                        {dimension.name}
                        <select
                            aria-label={`Prototype ${dimension.name}`}
                            value={session.modes[dimension.id] ?? ''}
                            onChange={(event) =>
                                setSession((previous) => {
                                    const modes = { ...previous.modes };
                                    if (event.target.value) {
                                        modes[dimension.id] = event.target.value;
                                    } else {
                                        delete modes[dimension.id];
                                    }

                                    return { ...previous, modes };
                                })
                            }
                        >
                            <option value="">
                                {dimension.selection === 'width'
                                    ? 'Auto · Viewport width'
                                    : 'Inherit from screen'}
                            </option>
                            {session.modes[dimension.id] &&
                                !dimension.modes[session.modes[dimension.id]] && (
                                    <option value={session.modes[dimension.id]}>
                                        Unavailable mode
                                    </option>
                                )}
                            {ordered(dimension.modes).map((mode) => (
                                <option key={mode.id} value={mode.id}>
                                    {mode.name}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
            </section>
            {session.screenId && !screens.some((screen) => screen.id === session.screenId) && (
                <p role="status">The start screen is unavailable. Choose another start screen.</p>
            )}
            {!screens.length ? (
                <p>Create a screen on the canvas to start a prototype.</p>
            ) : (
                <div className={styles.player}>
                    <InteractivePreview
                        key={`${session.screenId}:${restart}`}
                        session={session}
                        onWidth={(value) => resize('width', value)}
                        onReset={reset}
                        onLocate={locate}
                    />
                </div>
            )}
        </main>
    );
}
