import {
    ArrowLeft,
    Info,
    Monitor,
    Moon,
    RotateCcw,
    SlidersHorizontal,
    Smartphone,
    Sun,
    Tablet,
    Workflow
} from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { Button, Field, Select } from 'src/ui/components/Controls';
import { Dialog } from 'src/ui/components/Dialog';
import { DevicePicker } from './DevicePicker';
import { SharePrototype } from './SharePrototype';
import { DownloadPrototype } from './DownloadPrototype';
import { AccessibilityCheck } from './AccessibilityCheck';
import { Guide } from 'src/ui/components/FirstRun/Guide';
import { registerEditor } from './registerEditor';
import React, { useEffect, useRef, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { screenFrames } from 'src/app/screens';
import { prototypeModes, prototypeSession } from 'src/app/modeEdits';
import { isSizesDimension, ordered } from 'src/app/variableModes';
import { presetOfSize } from 'src/app/services/viewportPresets';
import {
    checkContexts,
    choiceDimensions,
    defaultChoice,
    type ContextChoice
} from 'src/app/accessibilityCheck';
import type { PreviewDiagnostic, PreviewSession, PreviewInspection } from 'src/preview/project';
import InteractivePreview from 'src/ui/components/InteractivePreview/InteractivePreview';
import styles from './Prototype.css';

registerEditor();

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
                    <AccessibilityCheck
                        session={session}
                        contexts={contexts}
                        onShow={(id) => locate({ kind: 'shape', id, message: '' })}
                    />
                    <DownloadPrototype
                        session={session}
                        inspection={inspection}
                        contexts={'contexts' in contexts ? contexts.contexts : []}
                    />
                    <SharePrototype session={session} inspection={inspection} />
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
                    <DevicePicker
                        size={session.viewport!}
                        onSize={(viewport) => setSession((previous) => ({ ...previous, viewport }))}
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
                    </DevicePicker>
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
                                                : (presetOfSize(presets, session.viewport)?.id ??
                                                  'custom')
                                        }
                                        onChange={(event) => {
                                            const preset = presets.find(
                                                ({ id }) => id === event.target.value
                                            );
                                            setCustomPreset(!preset);
                                            if (!preset) {
                                                setSettings(true);

                                                return;
                                            }
                                            setSession((previous) => ({
                                                ...previous,
                                                viewport: { ...preset.size }
                                            }));
                                        }}
                                    >
                                        {presets.map((preset) => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.name}
                                            </option>
                                        ))}
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
                                    onClick={() => setSettings(true)}
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
            <Guide page="prototype" />
        </main>
    );
}
