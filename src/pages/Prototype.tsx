import {
    ArrowLeft,
    Info,
    Monitor,
    Moon,
    RotateCcw,
    SlidersHorizontal,
    Smartphone,
    Sparkles,
    Sun,
    Tablet,
    Workflow
} from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { Button, Field, Select } from 'src/ui/components/Controls';
import { Dialog } from 'src/ui/components/Dialog';
import { DeviceMenu } from './DeviceMenu';
import { SharePrototype } from './SharePrototype';
import { DownloadPrototype } from './DownloadPrototype';
import { AccessibilityCheck } from './AccessibilityCheck';
import { Guide } from 'src/ui/components/FirstRun/Guide';
import { registerEditor } from './registerEditor';
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAiAvailable } from 'src/app/aiHooks';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import { screenFrames } from 'src/app/screens';
import { prototypeModes, prototypeSession } from 'src/app/modeEdits';
import { isSizesDimension, ordered } from 'src/app/variableModes';
import {
    checkContexts,
    choiceDimensions,
    defaultChoice,
    type ContextChoice
} from 'src/app/accessibilityCheck';
import type { PreviewDiagnostic, PreviewSession, PreviewInspection } from 'src/preview/project';
import InteractivePreview from 'src/ui/components/InteractivePreview/InteractivePreview';
import type { PrototypeProposal } from 'src/ui/components/EditWithWords/PrototypeBar';
import styles from './Prototype.css';

registerEditor();

const PrototypeBar = lazy(() =>
    import(/* webpackChunkName: "ai" */ 'src/ui/components/EditWithWords/PrototypeBar').then(
        (module) => ({ default: module.PrototypeBar })
    )
);

export function PrototypePage() {
    const id = useAppState((state) => state.currentDocumentId);

    return <PrototypeWorkspace key={id} />;
}

/** A picture for a size by its width: phone, tablet or screen. */
const deviceIcon = (width: number) => (width < 600 ? Smartphone : width < 1100 ? Tablet : Monitor);

/** A sun or moon for light and dark modes; other modes go without. */
function ModeMark({ name }: { name: string }) {
    const mark = /dark|night/i.test(name) ? Moon : /light|day/i.test(name) ? Sun : undefined;

    return mark ? <Icon icon={{ component: mark, size: 14 }} /> : null;
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
        <Field
            label={<span title={label}>{label[0]}</span>}
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
    );
}

function PrototypeWorkspace() {
    const document = useAppState((state) => state.currentDocument);
    const seed: PreviewSession = useAppState(prototypeModes);
    const presets = useAppState((state) => state.config.viewportPresets);
    const rules = useAppState((state) => state.config.accessibility);
    const screens = screenFrames(document);
    const effects = useEffects();
    const actions = useActions();
    const [session, setSession] = useState<PreviewSession>(() =>
        prototypeSession(
            document,
            seed,
            new URLSearchParams(window.location.search).get('screen'),
            presets[0].size
        )
    );
    const [inspection, setInspection] = useState<PreviewInspection>({});
    // The modes and sizes the accessibility check covers and a download carries.
    const [choice, setChoice] = useState<ContextChoice>(() => defaultChoice(document, presets));
    const contexts = checkContexts(document, presets, choice, rules);
    const toggle = (list: string[], id: string, on: boolean) =>
        on ? [...new Set([...list, id])] : list.filter((item) => item !== id);
    const [settings, setSettings] = useState(false);
    const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
    const [restart, setRestart] = useState(0);
    const reset = () => setRestart((value) => value + 1);
    // Restart remounts the preview and its header controls, so focus moves to the new button.
    const refocusRestart = useRef(false);
    const aiAvailable = useAiAvailable();
    const editable = useAppState((state) => !isReadOnly(state) && !state.currentDocument.locked);
    const [aiBar, setAiBar] = useState(false);
    const [proposal, setProposal] = useState<PrototypeProposal>();
    const [shownScreen, setShownScreen] = useState<string>();
    const shown = screens.find((screen) => screen.id === shownScreen);
    const aiButton = useRef<HTMLButtonElement>(null);
    // Focus goes back to the button the bar opened from.
    const closeAiBar = useCallback(() => {
        setAiBar(false);
        aiButton.current?.focus();
    }, []);
    // A new start page is tried from the start; a changed control is tried where it is shown.
    const applied = useCallback(({ start }: PrototypeProposal) => {
        if (start) {
            setSession((previous) => ({ ...previous, screenId: start }));
        }
    }, []);
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
            <header className={styles.bar}>
                <a href="/" className={styles.back} aria-label="Canvas">
                    <Icon icon={{ component: ArrowLeft, size: 18 }} />
                    <span>Canvas</span>
                </a>
                <div className={styles.identity}>
                    <h1 className={styles.documentName} title={document.name}>
                        {document.name}
                    </h1>
                    {screens.length > 0 && (
                        <span className={styles.summary}>
                            · {screens.length} {screens.length === 1 ? 'page' : 'pages'}
                        </span>
                    )}
                </div>
                <div className={styles.barActions}>
                    {aiAvailable && editable && screens.length > 0 && (
                        <button
                            ref={aiButton}
                            type="button"
                            className={styles.roundButton}
                            aria-label="AI bar"
                            title="Change what taps do in words"
                            aria-pressed={aiBar}
                            onClick={() => setAiBar(!aiBar)}
                        >
                            <Icon icon={{ component: Sparkles, size: 18 }} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.roundButton}
                        aria-label="Prototype settings"
                        title="Settings"
                        onClick={() => setSettings(true)}
                    >
                        <Icon icon={{ component: SlidersHorizontal, size: 18 }} />
                    </button>
                    <DownloadPrototype
                        session={session}
                        inspection={inspection}
                        contexts={'contexts' in contexts ? contexts.contexts : []}
                    />
                    <AccessibilityCheck
                        session={session}
                        contexts={contexts}
                        onShow={(id) => locate({ kind: 'shape', id, message: '' })}
                    />
                    <SharePrototype session={session} inspection={inspection} />
                    <a href="/flow" className={styles.flowLink} aria-label="Flow" title="Flow">
                        <Icon icon={{ component: Workflow, size: 18 }} />
                        <span>Flow</span>
                    </a>
                </div>
            </header>
            <Dialog
                title="Prototype settings"
                visible={settings}
                onClose={() => setSettings(false)}
                actions={
                    <Button kind="primary" onClick={() => setSettings(false)}>
                        Done
                    </Button>
                }
            >
                <div className={styles.controls}>
                    <Select
                        label="Start page"
                        aria-label="Start page"
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
                            <option value={session.screenId ?? ''}>Choose an available page</option>
                        )}
                        {screens.map((screen) => (
                            <option key={screen.id} value={screen.id}>
                                {screen.name}
                            </option>
                        ))}
                    </Select>
                    {ordered(document.dimensions).map((dimension) => (
                        <Select
                            key={dimension.id}
                            label={dimension.name}
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
                                {isSizesDimension(document.dimensions, dimension.id)
                                    ? 'Auto · Viewport width'
                                    : 'Inherit from page'}
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
                        </Select>
                    ))}
                    <p>
                        Changes apply only to this session. Restart returns to the start page and
                        resets input and state.
                    </p>
                    <fieldset className={styles.contexts}>
                        <legend>Check and download in</legend>
                        {choiceDimensions(document).map((dimension) => (
                            <div key={dimension.id} role="group" aria-label={dimension.name}>
                                <span>{dimension.name}</span>
                                {ordered(dimension.modes).map((mode) => (
                                    <label key={mode.id}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                !choice.modes[dimension.id] ||
                                                choice.modes[dimension.id].includes(mode.id)
                                            }
                                            onChange={(event) =>
                                                setChoice((previous) => ({
                                                    ...previous,
                                                    modes: {
                                                        ...previous.modes,
                                                        [dimension.id]: toggle(
                                                            previous.modes[dimension.id] ??
                                                                ordered(dimension.modes).map(
                                                                    ({ id }) => id
                                                                ),
                                                            mode.id,
                                                            event.target.checked
                                                        )
                                                    }
                                                }))
                                            }
                                        />
                                        <ModeMark name={mode.name} />
                                        {mode.name}
                                    </label>
                                ))}
                            </div>
                        ))}
                        <div role="group" aria-label="Sizes">
                            <span>Sizes</span>
                            {presets.map((preset) => (
                                <label key={preset.id}>
                                    <input
                                        type="checkbox"
                                        checked={choice.sizes.includes(preset.id)}
                                        onChange={(event) =>
                                            setChoice((previous) => ({
                                                ...previous,
                                                sizes: toggle(
                                                    previous.sizes,
                                                    preset.id,
                                                    event.target.checked
                                                )
                                            }))
                                        }
                                    />
                                    <Icon
                                        icon={{
                                            component: deviceIcon(preset.size.width),
                                            size: 14
                                        }}
                                    />
                                    {preset.name}
                                </label>
                            ))}
                        </div>
                        <p className={styles.combinations}>
                            <Icon icon={{ component: Info, size: 16 }} />
                            {'problem' in contexts
                                ? contexts.problem
                                : `The accessibility check and downloads cover ${contexts.contexts.length} ${contexts.contexts.length === 1 ? 'combination' : 'combinations'}. A download can be viewed in each.`}
                        </p>
                    </fieldset>
                </div>
            </Dialog>
            {session.screenId && !screens.some((screen) => screen.id === session.screenId) && (
                <p role="status">
                    The start page is unavailable. Open Settings to choose another start page.
                </p>
            )}
            {!screens.length ? (
                <p>Create a page on the canvas to start a prototype.</p>
            ) : (
                <div className={styles.player}>
                    <div ref={setToolbarTarget} className={styles.controlsRow} />
                    <InteractivePreview
                        key={`${session.screenId}:${restart}`}
                        session={session}
                        toolbarTarget={toolbarTarget}
                        toolbar={
                            <>
                                <DeviceMenu
                                    size={session.viewport!}
                                    onSize={(viewport) =>
                                        setSession((previous) => ({ ...previous, viewport }))
                                    }
                                >
                                    <ViewportField
                                        label="Width"
                                        value={session.viewport!.width}
                                        change={(value) => resize('width', value)}
                                    />
                                    <span aria-hidden="true">×</span>
                                    <ViewportField
                                        label="Height"
                                        value={session.viewport!.height}
                                        change={(value) => resize('height', value)}
                                    />
                                </DeviceMenu>
                                <button
                                    ref={(button) => {
                                        if (button && refocusRestart.current) {
                                            refocusRestart.current = false;
                                            button.focus();
                                        }
                                    }}
                                    className={styles.roundButton}
                                    aria-label="Restart prototype"
                                    title="Restart prototype"
                                    onClick={() => {
                                        refocusRestart.current = true;
                                        reset();
                                    }}
                                >
                                    <Icon icon={{ component: RotateCcw, size: 18 }} />
                                </button>
                            </>
                        }
                        outline={aiBar ? proposal?.controls : undefined}
                        onScreen={setShownScreen}
                        onWidth={(value) => resize('width', value)}
                        onReset={reset}
                        onInspection={setInspection}
                        onLocate={locate}
                    />
                </div>
            )}
            {aiBar && aiAvailable && editable && screens.length > 0 && (
                <Suspense fallback={null}>
                    <div className={styles.aiBar}>
                        <PrototypeBar
                            documentId={document.id}
                            screen={shown && { id: shown.id, name: shown.name }}
                            onPreview={setProposal}
                            onApplied={applied}
                            onClose={closeAiBar}
                        />
                    </div>
                </Suspense>
            )}
            <Guide page="prototype" />
        </main>
    );
}
