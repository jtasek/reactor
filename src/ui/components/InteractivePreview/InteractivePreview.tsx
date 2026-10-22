import React, { useEffect, useRef, useState } from 'react';
import { usePreviewProjection, type PreviewProjection } from 'src/preview/hooks';
import type { PreviewApplication } from 'src/preview/protocol';
import styles from './styles.css';

export default function InteractivePreview() {
    const live = usePreviewProjection();
    // Keep showing the last result while a drag pauses updates.
    const settled = useRef<PreviewProjection>(live);
    if (!live.paused) {
        settled.current = live;
    }
    const projection = settled.current;
    const frame = useRef<HTMLIFrameElement>(null);
    const connection = useRef<MessagePort | null>(null);
    const latest = useRef<PreviewApplication | null>(null);
    const [ready, setReady] = useState(false);
    const [origin, setOrigin] = useState<string | null>(null);
    const [availability, setAvailability] = useState('Loading preview…');
    const [runtimeProblem, setProblem] = useState<string | null>(null);
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
        if (!projection.serialized) {
            return;
        }
        const application: PreviewApplication = JSON.parse(projection.serialized);
        latest.current = application;
        connection.current?.postMessage(application);
        setProblem(null);
    }, [projection.serialized]);

    useEffect(() => () => connection.current?.close(), []);
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
    const connect = () => {
        connection.current?.close();
        const channel = new MessageChannel();
        connection.current = null;
        channel.port1.onmessage = (event) => {
            if (event.data?.type === 'ready') {
                connection.current = channel.port1;
                setReady(true);
                setAvailability('');
                if (latest.current) {
                    channel.port1.postMessage(latest.current);
                }
            }
            if (event.data?.type === 'error') {
                setProblem(
                    typeof event.data.message === 'string' ? event.data.message : 'Preview failed.'
                );
            }
        };
        // The sandbox has an opaque origin. Only its captured Window receives the port;
        // the runtime checks the editor's origin and source before accepting it.
        frame.current?.contentWindow?.postMessage({ type: 'reactor-preview-connect' }, '*', [
            channel.port2
        ]);
    };

    return (
        <section className={styles.preview} aria-label="Interactive preview">
            {availability && <p role="status">{availability}</p>}
            {problem && (
                <div role="status">
                    <strong>Preview needs attention</strong>
                    <p>{problem}</p>
                    {latest.current && <p>Showing the last valid preview.</p>}
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
            {origin && (
                <iframe
                    ref={frame}
                    title="Application preview"
                    src={`${origin}/`}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    onLoad={connect}
                />
            )}
        </section>
    );
}
