import { WorkspaceMembers } from './WorkspaceMembers';
import React, { FC, SubmitEvent, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useAccount, useAppState, useEffects } from 'src/app/hooks';
import type { Workspace } from 'src/app/services/api';
import {
    invitations,
    invitationPath,
    type Invitation,
    type InvitationRole
} from 'src/app/services/invitations';
import { Avatars } from 'src/ui/components/Avatars';
import styles from './Sharing.css';

export const Sharing: FC = () => {
    const account = useAccount();
    const { api, reloadPage } = useEffects();
    const currentWorkspace = useAppState(
        (state) => state.documentAccess[state.currentDocumentId]?.workspaceId
    );
    const [preferredWorkspace] = useState(currentWorkspace);
    const [workspaces, setWorkspaces] = useState<Workspace[]>();
    const [workspaceId, setWorkspaceId] = useState('');
    const [pending, setPending] = useState<Invitation[]>();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<InvitationRole>('editor');
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string>();
    const [created, setCreated] = useState<{ id: string; email: string; link: string }>();
    const link = created?.link ?? '';
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (account.kind !== 'signedIn') return;
        let active = true;
        api.workspaces()
            .then((all) => {
                if (!active) return;
                const admins = all.filter((workspace) => workspace.role === 'admin');
                setWorkspaces(admins);
                setWorkspaceId(
                    admins.find(({ id }) => id === preferredWorkspace)?.id ?? admins[0]?.id ?? ''
                );
            })
            .catch(() => {
                if (active) setProblem('Workspaces could not be loaded. Reload to try again.');
            });
        return () => {
            active = false;
        };
    }, [account.kind, api, preferredWorkspace]);

    useEffect(() => {
        setPending(undefined);
        setCreated(undefined);
        setCopied(false);
        if (!workspaceId) return;
        const controller = new AbortController();
        invitations
            .list(workspaceId, controller.signal)
            .then(setPending)
            .catch((error: Error) => {
                if (!controller.signal.aborted) setProblem(error.message);
            });
        return () => controller.abort();
    }, [workspaceId]);

    const invite = async (event: SubmitEvent) => {
        event.preventDefault();
        if (busy || !workspaceId || pending === undefined) return;
        setBusy(true);
        setProblem(undefined);
        setCreated(undefined);
        setCopied(false);
        try {
            const created = await invitations.create(workspaceId, email, role);
            setCreated({
                id: created.id,
                email: created.email,
                link: window.location.origin + invitationPath(created.token)
            });
            setEmail('');
            setPending(await invitations.list(workspaceId));
        } catch (error) {
            setProblem(
                error instanceof Error
                    ? error.message
                    : 'The server could not be reached. Please try again.'
            );
        } finally {
            setBusy(false);
        }
    };
    const revoke = async (id: string) => {
        setBusy(true);
        setProblem(undefined);
        try {
            await invitations.revoke(workspaceId, id);
            setPending((items) => items?.filter((item) => item.id !== id));
            setCreated((current) => (current?.id === id ? undefined : current));
        } catch (error) {
            setProblem(
                error instanceof Error ? error.message : 'The invitation could not be revoked.'
            );
        } finally {
            setBusy(false);
        }
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
        } catch {
            setProblem('Select and copy the invitation link below.');
        }
    };

    return (
        <main className={styles.page}>
            <div className={styles.content}>
                <nav aria-label="Sharing page">
                    <a href="/documents">Documents</a> · <a href="/account">Account</a>
                </nav>
                <h1>Sharing</h1>
                <p>
                    Invite someone to all documents in a workspace, including documents added later.
                </p>
                {account.kind !== 'signedIn' ? (
                    <p>
                        Sign in to manage workspace invitations.{' '}
                        <a href="/login?returnTo=/sharing">Sign in</a>
                    </p>
                ) : (
                    <>
                        {workspaces === undefined ? (
                            <p role="status">Loading workspaces…</p>
                        ) : workspaces.length === 0 ? (
                            <p>You are not an admin of any workspace.</p>
                        ) : (
                            <>
                                <section className={styles.card} aria-labelledby="invite-heading">
                                    <h2 id="invite-heading">Invite to a workspace</h2>
                                    <label>
                                        Workspace
                                        <select
                                            disabled={busy}
                                            value={workspaceId}
                                            onChange={(event) => {
                                                setProblem(undefined);
                                                setWorkspaceId(event.target.value);
                                            }}
                                        >
                                            {workspaces.map((workspace) => (
                                                <option key={workspace.id} value={workspace.id}>
                                                    {workspace.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <form onSubmit={invite}>
                                        <label>
                                            Email
                                            <input
                                                type="email"
                                                autoComplete="email"
                                                required
                                                maxLength={254}
                                                value={email}
                                                disabled={busy}
                                                onChange={(event) => setEmail(event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            Access
                                            <select
                                                value={role}
                                                disabled={busy}
                                                onChange={(event) =>
                                                    setRole(event.target.value as InvitationRole)
                                                }
                                            >
                                                <option value="editor">
                                                    Editor — can edit documents
                                                </option>
                                                <option value="viewer">
                                                    Viewer — can view documents
                                                </option>
                                            </select>
                                        </label>
                                        <p className={styles.secondary}>
                                            Only this email address can accept. Links expire after 7
                                            days. Creating another invitation for the same email
                                            replaces its pending link.
                                        </p>
                                        <button
                                            type="submit"
                                            disabled={busy || !workspaceId || pending === undefined}
                                        >
                                            {busy ? 'Please wait…' : 'Create invitation'}
                                        </button>
                                    </form>
                                    {link && (
                                        <div role="status" className={styles.result}>
                                            <p>
                                                Invitation ready. Copy the link and send it to the
                                                recipient.
                                            </p>
                                            <label>
                                                Invitation link
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={link}
                                                    onFocus={(event) => event.target.select()}
                                                />
                                            </label>
                                            <button type="button" onClick={copy}>
                                                {copied ? 'Copied' : 'Copy invitation link'}
                                            </button>
                                        </div>
                                    )}
                                </section>
                                <WorkspaceMembers
                                    key={workspaceId}
                                    workspaceId={workspaceId}
                                    onRemoved={(email) => {
                                        setCreated((current) =>
                                            current?.email.toLowerCase() === email.toLowerCase()
                                                ? undefined
                                                : current
                                        );
                                        setPending((current) =>
                                            current?.filter(
                                                (item) =>
                                                    item.email.toLowerCase() !== email.toLowerCase()
                                            )
                                        );
                                    }}
                                />
                                <section className={styles.card} aria-labelledby="pending-heading">
                                    <h2 id="pending-heading">Pending invitations</h2>
                                    <p className={styles.secondary}>
                                        Revoking a pending invitation invalidates its link. It does
                                        not remove someone who has already joined.
                                    </p>
                                    {pending === undefined ? (
                                        <p role="status">Loading invitations…</p>
                                    ) : pending.length === 0 ? (
                                        <p>No pending invitations.</p>
                                    ) : (
                                        <ul className={styles.list}>
                                            {pending.map((item) => (
                                                <li key={item.id}>
                                                    <Avatars
                                                        people={[{ name: item.email }]}
                                                        decorative
                                                    />
                                                    <div className={styles.person}>
                                                        <strong>{item.email}</strong>
                                                        <span>
                                                            {item.role === 'editor'
                                                                ? 'Editor'
                                                                : 'Viewer'}
                                                        </span>
                                                        <span>
                                                            <CalendarDays
                                                                size={14}
                                                                strokeWidth={1.5}
                                                                aria-hidden="true"
                                                            />{' '}
                                                            Expires{' '}
                                                            <time dateTime={item.expiresAt}>
                                                                {new Date(
                                                                    item.expiresAt
                                                                ).toLocaleDateString()}
                                                            </time>
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        aria-label={`Revoke invitation for ${item.email}`}
                                                        onClick={() => revoke(item.id)}
                                                    >
                                                        Revoke
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            </>
                        )}
                    </>
                )}
                {problem && (
                    <div role="alert">
                        <p>{problem}</p>
                        <button type="button" onClick={() => reloadPage()}>
                            Reload
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
};
