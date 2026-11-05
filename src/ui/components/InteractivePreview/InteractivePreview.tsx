import React, { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEffects } from 'src/app/hooks';
import { usePreviewProjection, type PreviewProjection } from 'src/preview/hooks';
import {
    PREVIEW_PROTOCOL_VERSION,
    type PreviewApplication,
    type PreviewDrawing
} from 'src/preview/protocol';
import { createPreviewResources } from 'src/preview/resources';
import type { PreviewInspection, PreviewSession, PreviewDiagnostic } from 'src/preview/project';
import styles from './styles.css';

export default function InteractivePreview({
    session,
    onWidth,
    onReset,
    onInspection,
    onLocate,
    toolbar,
    settingsTarget
}: {
    session?: PreviewSession;
    toolbar?: ReactNode;
    settingsTarget?: HTMLElement | null;
    onWidth?: (width: number) => void;
    onReset?: () => void;
    onInspection?: (inspection: PreviewInspection) => void;
    onLocate?: (diagnostic: PreviewDiagnostic) => void;
} = {}) {
    const { assets } = useEffects();
    const diagnosticId = useId();
    const prepare = useMemo(() => createPreviewResources(assets), [assets]);
    const [currentScreen, setCurrentScreen] = useState<string>();
    const [hostControls, setHostControls] = useState(false);
    const [inspection, setInspection] = useState<PreviewInspection>({});
    useEffect(() => onInspection?.(inspection), [inspection, onInspection]);
    const live = usePreviewProjection(inspection, session);
    // Keep showing the last result while a drag pauses updates.
    const settled = useRef<PreviewProjection>(live);
    if (!live.paused) {
        settled.current = live;
    }
    const projection = settled.current;
    const callbacks = useRef({ onWidth, onReset });
    callbacks.current = { onWidth, onReset };
    const frame = useRef<HTMLIFrameElement>(null);
    const connection = useRef<MessagePort | null>(null);
    const channelPort = useRef<MessagePort | null>(null);
    const latest = useRef<PreviewApplication | null>(null);
    // Images the runtime already has on the current channel, so each is sent only once.
    const sentImages = useRef(new Set<string>());
    const [ready, setReady] = useState(false);
    const [origin, setOrigin] = useState<string | null>(null);
    const [availability, setAvailability] = useState('Loading preview…');
    const [runtimeProblem, setProblem] = useState<string | null>(null);
    const [preparing, setPreparing] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const problem = projection.problem ?? runtimeProblem;

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/preview-config', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Preview configuration is unavailable.');
                }
                const data = await response.json();
                if (controller.signal.aborted) {
                    return;
                }
                if (!data.origin) {
                    setAvailability(
                        'Preview is not configured. Set PREVIEW_ORIGIN and start the separate preview server.'
                    );

                    return;
                }
                const url = new URL(data.origin);
                if (
                    !['http:', 'https:'].includes(url.protocol) ||
                    url.origin === window.location.origin ||
                    url.origin !== data.origin
                ) {
                    throw new Error('Invalid preview origin.');
                }
                setOrigin(url.origin);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setAvailability(
                        error instanceof Error ? error.message : 'Preview is unavailable.'
                    );
                }
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!projection.serialized || !origin) {
            setPreparing(false);

            return;
        }
        const drawing: PreviewDrawing = JSON.parse(projection.serialized);
        const controller = new AbortController();
        setPreparing(true);
        void prepare(drawing, controller.signal)
            .then((application) => {
                if (controller.signal.aborted) {
                    return;
                }
                latest.current = application;
                if (connection.current) {
                    send(connection.current, application);
                }
                setProblem(null);
                setPreparing(false);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setProblem(
                        error instanceof Error
                            ? error.message
                            : 'Preview images could not be prepared.'
                    );
                    setPreparing(false);
                }
            });

        return () => controller.abort();
    }, [projection.serialized, prepare, attempt, origin]);

    useEffect(() => () => channelPort.current?.close(), []);
    useEffect(() => {
        if (!origin || ready) {
            return;
        }
        const timeout = window.setTimeout(
            () =>
                setAvailability(
                    'Preview server did not respond. Check its address and EDITOR_ORIGIN configuration, then reopen Preview.'
                ),
            10000
        );

        return () => window.clearTimeout(timeout);
    }, [origin, ready]);
    /** Posts the drawing with only the images this channel has not received yet. */
    const send = (port: MessagePort, application: PreviewApplication) => {
        const images = Object.fromEntries(
            Object.entries(application.images).filter(([hash]) => !sentImages.current.has(hash))
        );
        port.postMessage({ ...application, images });
        sentImages.current = new Set(Object.keys(application.images));
    };
    const connect = () => {
        channelPort.current?.close();
        sentImages.current = new Set();
        const channel = new MessageChannel();
        channelPort.current = channel.port1;
        connection.current = null;
        setHostControls(false);
        setCurrentScreen(undefined);
        channel.port1.onmessage = (event) => {
            if (event.data?.type === 'current-screen') {
                if (latest.current?.screens.some((screen) => screen.id === event.data.screenId)) {
                    setCurrentScreen(event.data.screenId);
                }

                return;
            }
            if (event.data?.type === 'error') {
                // The runtime may not have kept this update's images; send them all next time.
                sentImages.current = new Set();
                setProblem(
                    typeof event.data.message === 'string' ? event.data.message : 'Preview failed.'
                );

                return;
            }
            if (
                event.data?.type === 'inspect-width' &&
                typeof event.data.width === 'number' &&
                Number.isFinite(event.data.width) &&
                event.data.width >= 1 &&
                event.data.width <= 10000
            ) {
                if (callbacks.current.onWidth) {
                    callbacks.current.onWidth(event.data.width);
                } else {
                    setInspection((previous) => ({ ...previous, width: event.data.width }));
                }

                return;
            }
            if (event.data?.type === 'inspect-reset') {
                setInspection({});
                callbacks.current.onReset?.();

                return;
            }
            if (event.data?.type === 'inspect-layout') {
                const { screenId, layoutId } = event.data;
                const screen = latest.current?.screens.find((screen) => screen.id === screenId);
                if (
                    screen &&
                    (layoutId === null || screen.layouts?.some((layout) => layout.id === layoutId))
                ) {
                    setInspection((previous) => ({
                        ...previous,
                        layouts: { ...previous.layouts, [screen.id]: layoutId }
                    }));
                }

                return;
            }
            if (event.data?.type !== 'ready') {
                return;
            }
            setReady(true);
            if (event.data.version !== PREVIEW_PROTOCOL_VERSION) {
                setAvailability(
                    'The preview server is out of date. Update it to match the editor, then reopen Preview.'
                );
                channel.port1.close();

                return;
            }
            connection.current = channel.port1;
            setAvailability('');
            const supportsHostControls = event.data.playerControls === true;
            setHostControls(supportsHostControls);
            if (session && supportsHostControls) {
                // Older runtimes own their navigation and must receive only drawing payloads.
                channel.port1.postMessage({ type: 'player-controls' });
            }
            if (latest.current) {
                send(channel.port1, latest.current);
            }
        };
        // The sandbox has an opaque origin. Only its captured Window receives the port;
        // the runtime checks the editor's origin and source before accepting it.
        frame.current?.contentWindow?.postMessage({ type: 'reactor-preview-connect' }, '*', [
            channel.port2
        ]);
    };

    const shown =
        latest.current?.screens.find((screen) => screen.id === currentScreen) ??
        latest.current?.screens[0];
    const layout = shown?.layouts && (
        <label>
            Layout
            <select
                aria-label="Preview layout"
                value={JSON.stringify(shown.layoutChoice ?? null)}
                onChange={(event) => {
                    const layoutId = JSON.parse(event.target.value) as string | null;
                    setInspection((previous) => ({
                        ...previous,
                        layouts: { ...previous.layouts, [shown.id]: layoutId }
                    }));
                }}
            >
                <option value="null">Automatic · Width</option>
                {shown.layoutChoice &&
                    !shown.layouts.some((item) => item.id === shown.layoutChoice) && (
                        <option value={JSON.stringify(shown.layoutChoice)}>
                            Missing layout — showing default
                        </option>
                    )}
                {shown.layouts.map((item) => (
                    <option key={item.id} value={JSON.stringify(item.id)}>
                        {item.name}
                    </option>
                ))}
            </select>
        </label>
    );

    return (
        <section
            className={styles.preview}
            data-player={Boolean(session)}
            aria-label="Interactive preview"
        >
            {session && (
                <div className={styles.toolbar} aria-label="Prototype controls">
                    {/* Kept (disabled) until the runtime answers so the toolbar doesn't shift on load. */}
                    {(hostControls || !ready) && (
                        <select
                            aria-label="Preview screen"
                            disabled={!ready || !currentScreen}
                            value={shown?.id ?? ''}
                            onChange={(event) => {
                                connection.current?.postMessage({
                                    type: 'select-screen',
                                    screenId: event.target.value
                                });
                            }}
                        >
                            {latest.current?.screens.map((screen) => (
                                <option key={screen.id} value={screen.id}>
                                    {screen.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {toolbar}
                </div>
            )}
            {session &&
                hostControls &&
                currentScreen &&
                settingsTarget &&
                createPortal(layout, settingsTarget)}
            {availability && <p role="status">{availability}</p>}
            {preparing && <p role="status">Preparing preview images…</p>}
            {problem && (
                <div role="status">
                    {!session && <strong>Preview needs attention</strong>}
                    <p>{problem}</p>
                    {latest.current && <p>Showing the last valid preview.</p>}
                    {runtimeProblem && !projection.problem && (
                        <button
                            className={styles.retry}
                            type="button"
                            disabled={preparing}
                            onClick={() => setAttempt((attempt) => attempt + 1)}
                        >
                            Retry preview
                        </button>
                    )}
                </div>
            )}
            {!problem && projection.warnings.length > 0 && (
                <div role="status">
                    <strong>Preview needs attention</strong>
                    {projection.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                    ))}
                </div>
            )}
            {onLocate && projection.diagnostics.length > 0 && (
                <nav aria-label="Prototype diagnostics">
                    {projection.diagnostics.map((item, index) => (
                        <React.Fragment key={`${item.kind}:${item.id}:${index}`}>
                            <button
                                onClick={() => onLocate(item)}
                                title={item.message}
                                aria-describedby={`${diagnosticId}-${index}`}
                            >
                                Inspect {item.name ?? item.kind}
                            </button>
                            {/* Screen readers get the reason, which the title only shows on hover. */}
                            <span id={`${diagnosticId}-${index}`} hidden>
                                {item.message}
                            </span>
                        </React.Fragment>
                    ))}
                </nav>
            )}
            {origin && (
                <iframe
                    ref={frame}
                    title="Application preview"
                    src={`${origin}/${session ? '?player=prototype' : ''}`}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    onLoad={connect}
                />
            )}
        </section>
    );
}
