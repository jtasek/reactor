import {
    Accessibility,
    ArrowDownUp,
    CircleAlert,
    CircleCheck,
    Contrast,
    Crosshair,
    Tag
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from 'src/ui/components/Icon';
import { Button, Problem } from 'src/ui/components/Controls';
import { Dialog } from 'src/ui/components/Dialog';
import { useActions, useAppState } from 'src/app/hooks';
import {
    accessibilityContext,
    accessibilityIssues,
    checkAccessibility,
    issuePriority,
    ISSUE_PRIORITIES,
    fixOperations,
    type AccessibilityIssue,
    type CheckContext,
    type CheckedContext
} from 'src/app/accessibilityCheck';
import { propose, type Send } from 'src/ai/client';
import { ContextTooLarge, documentContext } from 'src/ai/context';
import { describeOperation } from 'src/ai/describe';
import type { ProposedOperation } from 'src/ai/operations';
import type { Operation, Provenance } from 'src/app/operations';
import { authoringKeys } from 'src/app/screenAuthoring';
import type { PreviewSession } from 'src/preview/project';
import styles from './AccessibilityCheck.css';

const sendToLocalModel: Send = (path, body, signal) =>
    import('src/ai/localModel').then(({ localSend }) => localSend(path, body, signal));

const PRIORITY_NAMES = { must: 'Must have', should: 'Should have', nice: 'Nice to have' };

const KIND_ICONS = { contrast: Contrast, name: Tag, focusOrder: ArrowDownUp };

const FIX_PROMPT = 'Fix the accessibility problems the check found.';

interface Checked {
    contexts: CheckedContext[];
    issues: AccessibilityIssue[];
}

type Proposal =
    | { status: 'idle' }
    | { status: 'proposing'; stop: () => void }
    | { status: 'proposed'; operations: Operation[]; by: Provenance }
    | { status: 'failed'; problem: string };

/**
 * Checks every page in each chosen mode and size, lists what fails once with where it
 * fails, and offers the fixes as one proposal a person accepts or discards.
 */
export function AccessibilityCheck({
    session,
    contexts,
    onShow
}: {
    session: PreviewSession;
    contexts: { contexts: CheckContext[] } | { problem: string };
    onShow: (shapeId: string) => void;
}) {
    const document = useAppState((state) => state.currentDocument);
    const rules = useAppState((state) => state.config.accessibility);
    const ai = useAppState((state) => state.ai);
    const { applyOperations, checkOperations } = useActions();
    const [opened, setOpened] = useState(false);
    const [checked, setChecked] = useState<Checked>();
    const [running, setRunning] = useState(false);
    const [proposal, setProposal] = useState<Proposal>({ status: 'idle' });
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), []);

    const run = () => {
        if (!('contexts' in contexts)) {
            setChecked(undefined);

            return;
        }
        setRunning(true);
        // Let “Checking…” show before the pages are drawn in every context.
        setTimeout(() => {
            const result = checkAccessibility(document, session, contexts.contexts, rules);
            setChecked({ contexts: result, issues: accessibilityIssues(document, result) });
            setRunning(false);
        });
    };
    const open = () => {
        setProposal({ status: 'idle' });
        setOpened(true);
        run();
    };
    const close = () => {
        request.current?.abort();
        setOpened(false);
    };

    const send: Send | null | undefined =
        ai === 'local' ? sendToLocalModel : ai === 'available' ? undefined : null;
    const issues = checked?.issues ?? [];
    const fixable = issues.filter(({ fix }) => fix);

    async function proposeFixes() {
        if (send === null) {
            setProposal({
                status: 'proposed',
                operations: fixOperations(issues),
                by: { kind: 'person' }
            });

            return;
        }
        const shapes = [...new Set(issues.flatMap(({ shapeId }) => shapeId ?? []))];
        let context: object;
        try {
            context = {
                ...documentContext({
                    ...document,
                    selectedShapesIds: shapes,
                    selectedFrameId: undefined
                }),
                accessibility: accessibilityContext(issues)
            };
        } catch (error) {
            if (!(error instanceof ContextTooLarge)) {
                throw error;
            }
            setProposal({ status: 'failed', problem: error.message });

            return;
        }
        const controller = new AbortController();
        request.current = controller;
        setProposal({ status: 'proposing', stop: () => controller.abort() });
        const result = await propose({
            send,
            documentId: document.id,
            request: { task: 'edit', prompt: FIX_PROMPT, context },
            reservedKeys: authoringKeys(document),
            check: (operations) => checkOperations({ documentId: document.id, operations }),
            signal: controller.signal
        });
        if (result.kind === 'proposed') {
            setProposal({
                status: 'proposed',
                operations: result.operations,
                by: { kind: 'ai', model: result.model, requestId: result.requestId }
            });
        } else {
            setProposal(
                result.kind === 'failed'
                    ? { status: 'failed', problem: result.problem }
                    : { status: 'idle' }
            );
        }
    }

    const accept = (operations: Operation[], by: Provenance) => {
        const result = applyOperations({ documentId: document.id, by, operations });
        if (!result.applied) {
            setProposal({ status: 'failed', problem: result.problem });

            return;
        }
        setProposal({ status: 'idle' });
        run();
    };

    const ranked = ISSUE_PRIORITIES.map((priority) => ({
        priority,
        issues: issues.filter((issue) => issuePriority(issue, rules) === priority)
    })).filter((group) => group.issues.length);
    const failed = checked?.contexts.filter(({ problem }) => problem) ?? [];
    const every = checked?.contexts.length ?? 0;

    return (
        <>
            <button onClick={open} aria-haspopup="dialog">
                <Icon icon={{ component: Accessibility, size: 18 }} />
                Accessibility
            </button>
            <Dialog title="Accessibility" visible={opened} wide onClose={close}>
                {'problem' in contexts ? (
                    <p role="status">{contexts.problem} Change it in Settings.</p>
                ) : running || !checked ? (
                    <p role="status">Checking {contexts.contexts.length} modes and sizes…</p>
                ) : (
                    <>
                        <div
                            className={styles.summary}
                            data-clear={issues.length === 0 || undefined}
                        >
                            <Icon
                                icon={{
                                    component: issues.length === 0 ? CircleCheck : CircleAlert,
                                    size: 20
                                }}
                            />
                            <div>
                                <p role="status">
                                    {issues.length === 0
                                        ? `No problems in ${every} ${every === 1 ? 'context' : 'contexts'}.`
                                        : `${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} in ${every} ${every === 1 ? 'context' : 'contexts'}; ${fixable.length} can be fixed here.`}
                                </p>
                                <p className={styles.covered}>
                                    Checked: {contexts.contexts.map(({ name }) => name).join(', ')}
                                </p>
                            </div>
                        </div>
                        {issues.length > 0 && (
                            <footer className={styles.footer}>
                                {proposal.status === 'proposed' ? (
                                    <ProposalReview
                                        operations={proposal.operations}
                                        onAccept={() => accept(proposal.operations, proposal.by)}
                                        onDiscard={() => setProposal({ status: 'idle' })}
                                    />
                                ) : proposal.status === 'proposing' ? (
                                    <>
                                        <p role="status">Proposing fixes…</p>
                                        <Button onClick={proposal.stop}>Stop</Button>
                                    </>
                                ) : (
                                    <>
                                        {proposal.status === 'failed' && (
                                            <Problem>{proposal.problem}</Problem>
                                        )}
                                        <p className={styles.note}>
                                            {send === null
                                                ? 'Shows the changes the check suggests before anything changes.'
                                                : 'AI proposes the changes; nothing changes until you accept.'}
                                        </p>
                                        <Button
                                            kind="primary"
                                            disabled={
                                                document.locked ||
                                                (send === null && fixable.length === 0)
                                            }
                                            onClick={() => void proposeFixes()}
                                        >
                                            {send === null ? 'Review fixes' : 'Propose fixes'}
                                        </Button>
                                    </>
                                )}
                            </footer>
                        )}
                        {failed.map(({ context, problem }) => (
                            <Problem key={context.id}>
                                {context.name} could not be drawn: {problem}
                            </Problem>
                        ))}
                        {ranked.map((group) => (
                            <section
                                key={group.priority}
                                aria-label={PRIORITY_NAMES[group.priority]}
                                data-priority={group.priority}
                            >
                                <h3 className={styles.priority}>
                                    {PRIORITY_NAMES[group.priority]}
                                    <span>{group.issues.length}</span>
                                </h3>
                                <ul className={styles.issues}>
                                    {group.issues.map((issue) => (
                                        <li key={issue.id} data-kind={issue.problem.kind}>
                                            <span className={styles.kind}>
                                                <Icon
                                                    icon={{
                                                        component: KIND_ICONS[issue.problem.kind],
                                                        size: 16
                                                    }}
                                                />
                                            </span>
                                            <div className={styles.issueText}>
                                                <p className={styles.message}>{issue.message}</p>
                                                <p className={styles.fix}>
                                                    {issue.fix?.text ?? issue.advice}
                                                </p>
                                                <p className={styles.tags}>
                                                    {issue.problem.kind === 'contrast' && (
                                                        <span
                                                            className={styles.sample}
                                                            style={{
                                                                color: issue.problem.color,
                                                                background: issue.problem.background
                                                            }}
                                                            aria-hidden="true"
                                                        >
                                                            Aa
                                                        </span>
                                                    )}
                                                    <span className={styles.where}>
                                                        {issue.screenName}
                                                    </span>
                                                    <span className={styles.where}>
                                                        {issue.contexts.length === every
                                                            ? 'In every context'
                                                            : `In ${issue.contexts.join(', ')}`}
                                                    </span>
                                                    {issue.fix && (
                                                        <span className={styles.fixable}>
                                                            Can be fixed here
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            {issue.shapeId && (
                                                <Button
                                                    className={styles.show}
                                                    onClick={() => {
                                                        close();
                                                        onShow(issue.shapeId!);
                                                    }}
                                                >
                                                    <Icon
                                                        icon={{
                                                            component: Crosshair,
                                                            size: 14
                                                        }}
                                                    />
                                                    Show
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </>
                )}
            </Dialog>
        </>
    );
}

function ProposalReview({
    operations,
    onAccept,
    onDiscard
}: {
    operations: Operation[];
    onAccept: () => void;
    onDiscard: () => void;
}) {
    const document = useAppState((state) => state.currentDocument);
    const proposed = operations as ProposedOperation[];

    return (
        <div className={styles.review} aria-label="Proposed changes" role="group">
            {proposed.length === 0 ? (
                <p>No changes proposed.</p>
            ) : (
                <ul>
                    {proposed.map((operation, index) => (
                        <li key={index}>{describeOperation(operation, document, proposed)}</li>
                    ))}
                </ul>
            )}
            <div className={styles.actions}>
                <Button onClick={onDiscard}>Discard</Button>
                <Button kind="primary" disabled={proposed.length === 0} onClick={onAccept}>
                    Accept
                </Button>
            </div>
        </div>
    );
}
