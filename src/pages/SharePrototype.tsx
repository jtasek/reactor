import { Check, Copy, Link2, Share } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { Button, Problem } from 'src/ui/components/Controls';
import { Dialog } from 'src/ui/components/Dialog';
import {
    drawingDocument,
    drawScreen,
    ScreenThumbnail
} from 'src/ui/components/DocumentList/DocumentThumbnail';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { screenFrames } from 'src/app/screens';
import { ordered } from 'src/app/variableModes';
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

/** What a new link opens: the start page as drawn, its page count, size and modes. */
function ShareSummary({ session, title }: { session: PreviewSession; title: string }) {
    const document = useAppState((state) => state.currentDocument);
    const picture = useMemo(
        () =>
            session.screenId
                ? drawScreen(
                      document,
                      drawingDocument(document, session.modes),
                      session.screenId,
                      session.modes
                  )
                : undefined,
        [document, session.screenId, session.modes]
    );
    const pages = screenFrames(document).length;
    const modes = ordered(document.dimensions).flatMap((dimension) => {
        const mode = dimension.modes[session.modes[dimension.id]];

        return mode ? [mode.name] : [];
    });

    return (
        <div className={styles.shareSummary}>
            <span className={styles.sharePicture} aria-hidden="true">
                {picture ? (
                    <ScreenThumbnail document={document} drawing={picture} label="Start page" />
                ) : (
                    <Icon icon={{ component: Link2, size: 22 }} />
                )}
            </span>
            <div>
                <h3>{title}</h3>
                <p>Anyone with the link can play it, no sign-in needed.</p>
                <ul className={styles.shareChips} aria-label="Link contents">
                    <li data-accent>
                        {pages} {pages === 1 ? 'page' : 'pages'}
                    </li>
                    {session.viewport && (
                        <li>
                            {session.viewport.width} × {session.viewport.height}
                        </li>
                    )}
                    {modes.map((name) => (
                        <li key={name}>{name}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

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
    const create = (
        <Button
            kind="primary"
            disabled={!allowed || pending || busy || !loaded || !session.screenId}
            onClick={() => void change()}
        >
            {pending ? 'Please wait…' : created ? 'Create new link' : 'Create snapshot link'}
        </Button>
    );
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
    ) : created ? (
        <>
            <Button onClick={close}>Done</Button>
            {create}
        </>
    ) : (
        <>
            {allowed && !loaded && !pending && (
                <Button onClick={() => setAttempt((value) => value + 1)}>
                    Retry loading links
                </Button>
            )}
            {create}
        </>
    );

    return (
        <>
            <button
                className={styles.roundButton}
                aria-label="Share prototype"
                title="Share prototype"
                onClick={() => setOpened(true)}
            >
                <Icon icon={{ component: Share, size: 18 }} />
            </button>
            <Dialog title="Share prototype" visible={opened} wide onClose={close} actions={actions}>
                <div className={styles.sharing}>
                    {opened && (
                        <ShareSummary
                            session={session}
                            title={
                                created?.url
                                    ? 'Your link is ready'
                                    : 'One link, the whole prototype'
                            }
                        />
                    )}
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
                                    <div className={styles.linkRow}>
                                        <div className={styles.linkPill}>
                                            <Icon icon={{ component: Link2, size: 18 }} />
                                            <input
                                                aria-label="Snapshot link"
                                                readOnly
                                                value={created.url}
                                                onFocus={(event) => event.target.select()}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.copy}
                                            aria-label={copied ? 'Copied' : 'Copy link'}
                                            onClick={copy}
                                        >
                                            <Icon
                                                icon={{
                                                    component: copied ? Check : Copy,
                                                    size: 18
                                                }}
                                            />
                                            <span className={styles.copyLabel}>
                                                {copied ? 'Copied' : 'Copy'}
                                            </span>
                                        </button>
                                    </div>
                                    <p className={styles.shareNote}>
                                        Copy it now: saved links can be revoked, but not shown
                                        again. Links expire after 30 days and later edits stay
                                        private.
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
                                                        className={styles.revoke}
                                                        disabled={pending}
                                                        aria-label={`Revoke ${link.name}`}
                                                        onClick={() => void change(link.id)}
                                                    >
                                                        Revoke
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
