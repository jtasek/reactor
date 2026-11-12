import { ArrowLeft, RotateCcw, SlidersHorizontal, Workflow } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { SharePrototype } from './SharePrototype';
import { registerEditor } from './registerEditor';
import React, { useEffect, useRef, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { screenFrames, startScreen } from 'src/app/screens';
import { prototypeModes } from 'src/app/modeEdits';
import { ordered } from 'src/app/variableModes';
import type { PreviewDiagnostic, PreviewSession, PreviewInspection } from 'src/preview/project';
import InteractivePreview from 'src/ui/components/InteractivePreview/InteractivePreview';
import styles from './Prototype.css';

registerEditor();

const VIEWPORT_PRESETS = {
    mobile: { width: 390, height: 844 },
    desktop: { width: 1280, height: 800 }
};

function viewportPreset(viewport: PreviewSession['viewport']) {
    return (
        Object.entries(VIEWPORT_PRESETS).find(
            ([, size]) => size.width === viewport?.width && size.height === viewport.height
        )?.[0] ?? 'custom'
    );
}

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
    const seed: PreviewSession = useAppState(prototypeModes);
    const screens = screenFrames(document);
    const effects = useEffects();
    const actions = useActions();
    const [session, setSession] = useState<PreviewSession>(() => {
        const requested = new URLSearchParams(window.location.search).get('screen');
        // A link's screen, then the view Play was pressed on, then the document's start.
        const initial =
            screens.find((screen) => screen.id === (requested ?? seed.screenId)) ??
            startScreen(document);
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
    const [inspection, setInspection] = useState<PreviewInspection>({});
    const settings = useRef<HTMLDialogElement>(null);
    const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
    // Custom stays chosen while its size still matches a preset.
    const [customPreset, setCustomPreset] = useState(false);
    const [restart, setRestart] = useState(0);
    const reset = () => setRestart((value) => value + 1);
    // Restart remounts the preview and its header controls, so focus moves to the new button.
    const refocusRestart = useRef(false);
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
            <header className={styles.header}>
                <a href="/">
                    <Icon icon={{ component: ArrowLeft, size: 18 }} />
                    Canvas
                </a>
                <div className={styles.identity}>
                    <h1>Prototype</h1>
                    <span className={styles.documentName} title={document.name}>
                        {document.name}
                    </span>
                </div>
                <div ref={setToolbarTarget} className={styles.toolbarSlot} />
                <div className={styles.headerActions}>
                    <a href="/flow">
                        <Icon icon={{ component: Workflow, size: 18 }} />
                        Flow
                    </a>
                    <SharePrototype session={session} inspection={inspection} />
                </div>
            </header>
            <dialog ref={settings} className={styles.settings} aria-label="Prototype settings">
                <header>
                    <h2>Prototype settings</h2>
                    <button onClick={() => settings.current?.close()}>Done</button>
                </header>
                <div className={styles.controls}>
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
                    <div className={styles.dimensions}>
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
                    </div>
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
                    <p>
                        Changes apply only to this session. Restart returns to the start screen and
                        resets input and state.
                    </p>
                </div>
            </dialog>
            {session.screenId && !screens.some((screen) => screen.id === session.screenId) && (
                <p role="status">
                    The start screen is unavailable. Open Settings to choose another start screen.
                </p>
            )}
            {!screens.length ? (
                <p>Create a screen on the canvas to start a prototype.</p>
            ) : (
                <div className={styles.player}>
                    <InteractivePreview
                        key={`${session.screenId}:${restart}`}
                        session={session}
                        toolbarTarget={toolbarTarget}
                        toolbar={
                            <>
                                <label>
                                    <span>Viewport</span>
                                    <select
                                        aria-label="Viewport preset"
                                        value={
                                            customPreset
                                                ? 'custom'
                                                : viewportPreset(session.viewport)
                                        }
                                        onChange={(event) => {
                                            setCustomPreset(event.target.value === 'custom');
                                            if (event.target.value === 'custom') {
                                                settings.current?.showModal();

                                                return;
                                            }
                                            const viewport =
                                                event.target.value === 'mobile'
                                                    ? VIEWPORT_PRESETS.mobile
                                                    : VIEWPORT_PRESETS.desktop;
                                            setSession((previous) => ({ ...previous, viewport }));
                                        }}
                                    >
                                        <option value="mobile">Mobile</option>
                                        <option value="desktop">Desktop</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </label>
                                <button
                                    ref={(button) => {
                                        if (button && refocusRestart.current) {
                                            refocusRestart.current = false;
                                            button.focus();
                                        }
                                    }}
                                    aria-label="Restart prototype"
                                    title="Restart prototype"
                                    onClick={() => {
                                        refocusRestart.current = true;
                                        reset();
                                    }}
                                >
                                    <Icon icon={{ component: RotateCcw, size: 18 }} />
                                    Restart
                                </button>
                                <button
                                    onClick={() => settings.current?.showModal()}
                                    aria-label="Prototype settings"
                                >
                                    <Icon icon={{ component: SlidersHorizontal, size: 18 }} />
                                    Settings
                                </button>
                            </>
                        }
                        onWidth={(value) => resize('width', value)}
                        onReset={reset}
                        onInspection={setInspection}
                        onLocate={locate}
                    />
                    <p className={styles.viewportSummary}>
                        {session.viewport?.width} × {session.viewport?.height} · Fit
                    </p>
                </div>
            )}
        </main>
    );
}
