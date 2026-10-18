import React, { FC, useEffect, useRef, useState } from 'react';
import { members, type WorkspaceMember } from 'src/app/services/members';
import { Avatars } from 'src/ui/components/Avatars';
import styles from './Sharing.css';

export const WorkspaceMembers: FC<{ workspaceId: string; onRemoved: (email: string) => void }> = ({
    workspaceId,
    onRemoved
}) => {
    const [people, setPeople] = useState<WorkspaceMember[]>();
    const [problem, setProblem] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<string>();
    const [attempt, setAttempt] = useState(0);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => {
        const current = new AbortController();
        controller.current = current;
        setProblem(undefined);
        members
            .list(workspaceId, current.signal)
            .then(setPeople)
            .catch((error: Error) => {
                if (!current.signal.aborted) setProblem(error.message);
            });
        return () => current.abort();
    }, [workspaceId, attempt]);

    const change = async (person: WorkspaceMember, role?: 'editor' | 'viewer') => {
        const signal = controller.current?.signal;
        setBusy(true);
        setProblem(undefined);
        try {
            if (role) await members.setRole(workspaceId, person.id, role, signal);
            else await members.remove(workspaceId, person.id, signal);
            if (signal?.aborted) return;
            setPeople((current) =>
                role
                    ? current?.map((item) => (item.id === person.id ? { ...item, role } : item))
                    : current?.filter(({ id }) => id !== person.id)
            );
            if (!role) onRemoved(person.email);
            setRemoving(undefined);
        } catch (error) {
            if (!signal?.aborted)
                setProblem(
                    error instanceof Error
                        ? error.message
                        : 'The request could not be completed. Please try again.'
                );
        } finally {
            if (!signal?.aborted) setBusy(false);
        }
    };

    return (
        <section className={styles.card} aria-labelledby="members-heading">
            <h2 id="members-heading">Members</h2>
            <p className={styles.secondary}>
                Access applies to all documents in this workspace. Owner and admin access are
                protected.
            </p>
            {people === undefined ? (
                !problem && <p role="status">Loading members…</p>
            ) : (
                <ul className={styles.list} aria-label="Workspace members">
                    {people.map((person) => (
                        <li key={person.id} className={styles.member}>
                            <Avatars
                                people={[
                                    { name: person.name || person.email, image: person.image }
                                ]}
                                decorative
                            />
                            <div className={styles.person}>
                                <strong>{person.name || person.email}</strong>
                                {person.name && <span>{person.email}</span>}
                            </div>
                            {person.owner || person.role === 'admin' ? (
                                <span>{person.owner ? 'Owner' : 'Admin'}</span>
                            ) : (
                                <div className={styles.memberActions}>
                                    {removing === person.id ? (
                                        <>
                                            <p>
                                                Remove {person.email}? They will lose access to all
                                                workspace documents, and their pending invitations
                                                will be revoked.
                                            </p>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => change(person)}
                                            >
                                                Confirm removal
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => setRemoving(undefined)}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <select
                                                aria-label={`Access for ${person.email}`}
                                                value={person.role}
                                                disabled={busy}
                                                onChange={(event) =>
                                                    change(
                                                        person,
                                                        event.target.value as 'editor' | 'viewer'
                                                    )
                                                }
                                            >
                                                <option value="editor">Editor</option>
                                                <option value="viewer">Viewer</option>
                                            </select>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                aria-label={`Remove ${person.email}`}
                                                onClick={() => setRemoving(person.id)}
                                            >
                                                Remove
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {problem && (
                <div role="alert">
                    <p>{problem}</p>
                    {people === undefined && (
                        <button type="button" onClick={() => setAttempt(attempt + 1)}>
                            Try again
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};
