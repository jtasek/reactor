import React, { useEffect, useRef, useState } from 'react';
import { useAppState, useEffects } from 'src/app/hooks';
import { projectPreview, type PreviewSession, type PreviewInspection } from 'src/preview/project';
import { createPreviewResources } from 'src/preview/resources';
import {
    listPrototypeLinks,
    publishPrototypeLink,
    revokePrototypeLink,
    type PrototypeLink
} from 'src/preview/shareRequests';
import styles from './Prototype.css';

export function SharePrototype({
    session,
    inspection
}: {
    session: PreviewSession;
    inspection: PreviewInspection;
}) {
    const { document, allowed, busy } = useAppState((state) => ({
        document: state.currentDocument,
        allowed:
            state.account.kind === 'signedIn' &&
            state.documentAccess[state.currentDocumentId]?.role === 'admin',
        busy: state.events.pointer.gesture.kind !== 'idle' || state.guideDragActive
    }));
    const { assets } = useEffects();
    const [opened, setOpened] = useState(false);
    const [links, setLinks] = useState<PrototypeLink[]>([]);
    const [pending, setPending] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [created, setCreated] = useState<PrototypeLink | null>(null);
    const [copied, setCopied] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const operation = useRef<AbortController | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const launcher = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (opened) {
            const trigger = launcher.current;
            dialog.current?.showModal();

            return () => trigger?.focus();
        }
    }, [opened]);

    useEffect(() => {
        if (!opened || !allowed) {
            return;
        }
        const controller = new AbortController();
        setPending(true);
        setProblem(null);
        void listPrototypeLinks(document.id, controller.signal)
            .then((items) => {
                if (!controller.signal.aborted) {
                    setLinks(items);
                    setLoaded(true);
                }
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setProblem(error instanceof Error ? error.message : 'Could not load links.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setPending(false);
                }
            });

        return () => controller.abort();
    }, [opened, allowed, document.id, attempt]);

    useEffect(() => () => operation.current?.abort(), []);

    async function change(revoke?: string) {
        const controller = new AbortController();
        operation.current = controller;
        setPending(true);
        setProblem(null);
        setCopied(false);
        try {
            if (revoke) {
                await revokePrototypeLink(document.id, revoke, controller.signal);
                if (!controller.signal.aborted) {
                    setLinks((items) => items.filter((item) => item.id !== revoke));
                    setCreated((item) => (item?.id === revoke ? null : item));
                }

                return;
            }
            const drawing = projectPreview(document, {}, [], session, inspection);
            if (!drawing.screens.length || drawing.screens[0].id !== session.screenId) {
                throw new Error('Choose an available start screen before sharing.');
            }
            const application = await createPreviewResources(assets)(drawing, controller.signal);
            const name =
                `${document.name} · ${session.viewport?.width} × ${session.viewport?.height}`.slice(
                    0,
                    200
                );
            const link = await publishPrototypeLink(
                document.id,
                name,
                application,
                controller.signal
            );
            if (!controller.signal.aborted) {
                setCreated(link);
                setLinks((items) => [link, ...items]);
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                setProblem(error instanceof Error ? error.message : 'Could not update links.');
            }
        } finally {
            if (!controller.signal.aborted) {
                setPending(false);
            }
        }
    }

    return (
        <>
            <button ref={launcher} onClick={() => setOpened(true)}>
                Share prototype
            </button>
            {opened && (
                <dialog
                    ref={dialog}
                    className={styles.sharing}
                    aria-label="Share prototype"
                    onCancel={(event) => {
                        if (pending) {
                            event.preventDefault();

                            return;
                        }
                        setOpened(false);
                    }}
                    onClose={() => setOpened(false)}
                >
                    <header>
                        <h2>Share prototype</h2>
                        <button disabled={pending} onClick={() => setOpened(false)}>
                            Close sharing
                        </button>
                    </header>
                    <p>
                        Anyone with the link can play this snapshot without signing in. It includes
                        all prototype screens and images, using the current start screen, viewport
                        and modes. Later edits stay private.
                    </p>
                    <p>
                        Links expire after 30 days. Revoking a link prevents future loads; it cannot
                        erase a copy already opened or downloaded.
                    </p>
                    {!allowed ? (
                        <p>
                            Save this document to your account. A workspace admin can then create
                            and revoke public links.
                        </p>
                    ) : (
                        <>
                            <button
                                disabled={pending || busy || !loaded || !session.screenId}
                                onClick={() => void change()}
                            >
                                {pending ? 'Please wait…' : 'Create snapshot link'}
                            </button>
                            {!loaded && !pending && (
                                <button onClick={() => setAttempt((value) => value + 1)}>
                                    Retry loading links
                                </button>
                            )}
                            {created?.url && (
                                <div className={styles.sharedLink}>
                                    <label>
                                        Snapshot link
                                        <input
                                            aria-label="Snapshot link"
                                            readOnly
                                            value={created.url}
                                            onFocus={(event) => event.target.select()}
                                        />
                                    </label>
                                    <button
                                        onClick={() => {
                                            void navigator.clipboard
                                                .writeText(created.url!)
                                                .then(() => setCopied(true))
                                                .catch(() =>
                                                    setProblem(
                                                        'Select the link and copy it manually.'
                                                    )
                                                );
                                        }}
                                    >
                                        {copied ? 'Copied' : 'Copy link'}
                                    </button>
                                    <p>
                                        Copy this link now. Saved links below can be revoked, but
                                        their secret URLs cannot be retrieved.
                                    </p>
                                </div>
                            )}
                            <ul>
                                {links.map((link) => (
                                    <li key={link.id}>
                                        <span>
                                            {link.name} · Expires{' '}
                                            {new Date(link.expires_at).toLocaleDateString()}
                                        </span>
                                        <button
                                            disabled={pending}
                                            aria-label={`Revoke ${link.name}`}
                                            onClick={() => void change(link.id)}
                                        >
                                            Revoke link
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {loaded && !links.length && <p>No active links.</p>}
                        </>
                    )}
                    {problem && <p role="alert">{problem}</p>}
                </dialog>
            )}
        </>
    );
}
