import React, { FC, useState } from 'react';
import { AI_DISCLOSURE } from 'src/ai/disclosure';
import { sharingRequest } from 'src/app/services/invitations';
import type { Workspace } from 'src/app/services/api';
import { Problem } from 'src/ui/components/Controls';
import styles from './Sharing.css';

/** An admin's switch for AI in a workspace, with what AI sends and what is kept. */
export const WorkspaceAi: FC<{ workspace: Workspace; onChanged: (ai: boolean) => void }> = ({
    workspace,
    onChanged
}) => {
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string>();

    const change = async (enabled: boolean) => {
        setBusy(true);
        setProblem(undefined);
        try {
            await sharingRequest<void>(
                'PUT',
                `/workspaces/${encodeURIComponent(workspace.id)}/ai`,
                { enabled }
            );
            onChanged(enabled);
        } catch (error) {
            setProblem(
                error instanceof Error ? error.message : 'The setting could not be changed.'
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={styles.card} aria-labelledby="ai-heading">
            <h2 id="ai-heading">AI</h2>
            <label className={styles.check}>
                <input
                    type="checkbox"
                    checked={workspace.ai}
                    disabled={busy}
                    onChange={(event) => change(event.target.checked)}
                />
                Let members use Edit with words in this workspace’s documents
            </label>
            <p className={styles.secondary}>
                {workspace.ai
                    ? 'Editors can ask AI to propose changes and review them before they are made.'
                    : 'AI is off: the editor hides its AI entries here and the server refuses AI requests.'}
            </p>
            <p className={styles.secondary}>{AI_DISCLOSURE.sent}</p>
            <p className={styles.secondary}>{AI_DISCLOSURE.kept}</p>
            {problem && <Problem>{problem}</Problem>}
        </section>
    );
};
