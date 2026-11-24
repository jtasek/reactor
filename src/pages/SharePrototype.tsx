import { Check, Copy, Link2, Share } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { Button, Field, Problem } from 'src/ui/components/Controls';
import { Dialog } from 'src/ui/components/Dialog';
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
import { markFirstRunStep, openAfterSignIn } from 'src/app/firstRun';
import { loginFrom } from 'src/app/services/accounts';
import styles from './Prototype.css';

export function SharePrototype({
    session,
    inspection
}: {
    session: PreviewSession;
    inspection: PreviewInspection;
}) {
    const { document, allowed, member, account, busy } = useAppState((state) => ({
        document: state.currentDocument,
        allowed:
            state.account.kind === 'signedIn' &&
            state.documentAccess[state.currentDocumentId]?.role === 'admin',
        member:
            state.account.kind === 'signedIn' &&
            state.documentAccess[state.currentDocumentId] !== undefined,
        account: state.account.kind,
        busy: state.events.pointer.gesture.kind !== 'idle' || state.guideDragActive
    }));
    const { assets, navigate } = useEffects();
    const [opened, setOpened] = useState(false);
    const [links, setLinks] = useState<PrototypeLink[]>([]);
    const [pending, setPending] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [created, setCreated] = useState<PrototypeLink | null>(null);
    const [copied, setCopied] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const operation = useRef<AbortController | null>(null);

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
                throw new Error('Choose an available start page before sharing.');
            }
            const application = await createPreviewResources(assets)(drawing, controller.signal);
            // Start screen and viewport tell links apart when one is revoked later.
            const start = document.frames[session.screenId!]?.name ?? 'Page';
            const name =
                `${document.name} · ${start} · ${session.viewport?.width} × ${session.viewport?.height}`.slice(
                    0,
                    200
                );
            const link = await publishPrototypeLink(
                document.id,
                name,
                application,
                document.created,
                controller.signal
            );
            if (!controller.signal.aborted) {
                markFirstRunStep(document.id, 'shared');
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

    const close = () => {
        if (!pending) {
            setOpened(false);
        }
    };
    const copy = () =>
        void navigator.clipboard
            .writeText(created!.url!)
            .then(() => setCopied(true))
            .catch(() => setProblem('Select the link and copy it manually.'));

    const signIn = account === 'signedOut' && !member;
    const actions = signIn ? (
        <Button
            kind="primary"
            onClick={() => {
                openAfterSignIn(document.id);
                navigate(loginFrom('designer'));
            }}
        >
            Sign in to share
        </Button>
    ) : (
        <>
            {allowed && !loaded && !pending && (
                <Button onClick={() => setAttempt((value) => value + 1)}>
                    Retry loading links
                </Button>
            )}
            <Button
                kind="primary"
                disabled={!allowed || pending || busy || !loaded || !session.screenId}
                onClick={() => void change()}
            >
                {pending ? 'Please wait…' : 'Create snapshot link'}
            </Button>
        </>
    );

    return (
        <>
            <button aria-label="Share prototype" onClick={() => setOpened(true)}>
                <Icon icon={{ component: Share, size: 18 }} />
                Share
            </button>
            <Dialog
                title="Share prototype"
                description="Anyone with the link can play it, without signing in."
                visible={opened}
                wide
                onClose={close}
                actions={actions}
            >
                <div className={styles.sharing}>
                    <div className={styles.shareIntro}>
                        <span className={styles.shareMark}>
                            <Icon icon={{ component: Link2, size: 22 }} />
                        </span>
                        <p>
                            <strong>One link, the whole prototype</strong>
                            <span>
                                Every page and image, at the current start page, size and modes.
                                Links expire after 30 days; later edits stay private.
                            </span>
                        </p>
                    </div>
                    {!allowed ? (
                        <p className={styles.shareState}>
                            {member
                                ? 'Only workspace admins can create and revoke public links for this document.'
                                : account === 'signedOut'
                                  ? 'Sign in to create a link. Reactor then offers to move this document into your account.'
                                  : account === 'signedIn'
                                    ? 'Save this document to your account. A workspace admin can then create and revoke public links.'
                                    : 'Sharing links needs a Reactor server with accounts.'}
                        </p>
                    ) : (
                        <>
                            {created?.url && (
                                <div className={styles.sharedLink}>
                                    <Field
                                        label="Snapshot link"
                                        readOnly
                                        value={created.url}
                                        onFocus={(event) => event.target.select()}
                                    />
                                    <Button
                                        className={styles.copy}
                                        aria-label={copied ? 'Copied' : 'Copy link'}
                                        title={copied ? 'Copied' : 'Copy link'}
                                        onClick={copy}
                                    >
                                        <Icon
                                            icon={{ component: copied ? Check : Copy, size: 18 }}
                                        />
                                    </Button>
                                    <p className={styles.shareNote}>
                                        Copy it now: saved links can be revoked, but not shown
                                        again.
                                    </p>
                                </div>
                            )}
                            {loaded && (
                                <section className={styles.links} aria-label="Active links">
                                    <h3>Active links</h3>
                                    {links.length ? (
                                        <ul>
                                            {links.map((link) => (
                                                <li key={link.id}>
                                                    <span>
                                                        <strong>{link.name}</strong>
                                                        <small
                                                            data-outdated={
                                                                link.outdated || undefined
                                                            }
                                                        >
                                                            {link.outdated
                                                                ? 'Out of date, no longer opens. Revoke it and create a new link.'
                                                                : `Created ${new Date(link.created_at).toLocaleDateString()} · Expires ${new Date(link.expires_at).toLocaleDateString()}`}
                                                        </small>
                                                    </span>
                                                    <Button
                                                        kind="quiet"
                                                        disabled={pending}
                                                        aria-label={`Revoke ${link.name}`}
                                                        onClick={() => void change(link.id)}
                                                    >
                                                        Revoke link
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={styles.shareNote}>No active links.</p>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                    {problem && <Problem>{problem}</Problem>}
                </div>
            </Dialog>
        </>
    );
}
