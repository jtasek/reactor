import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useAppState, useEffects } from 'src/app/hooks';
import {
    closeFirstRunGuide,
    markFirstRunStep,
    useFirstRunGuide,
    type FirstRunGuide
} from 'src/app/firstRun';
import styles from './styles.css';

const Step = ({
    done,
    title,
    children
}: {
    done?: boolean;
    title: string;
    children: React.ReactNode;
}) => (
    <li data-done={done ? '' : undefined}>
        <span className={styles.mark} aria-hidden="true">
            {done && <Check size={12} strokeWidth={2.5} />}
        </span>
        <div>
            <strong>
                {title}
                {done && <span className={styles.hidden}> (done)</span>}
            </strong>
            {children}
        </div>
    </li>
);

function GuideCard({ guide, page }: { guide: FirstRunGuide; page: 'editor' | 'prototype' }) {
    const { navigate } = useEffects();
    const edited = useAppState(
        (state) => state.documents[guide.documentId]?.history.canUndo ?? false
    );

    useEffect(() => {
        if (edited) {
            markFirstRunStep(guide.documentId, 'edited');
        }
    }, [edited, guide.documentId]);

    useEffect(() => {
        if (page === 'prototype') {
            markFirstRunStep(guide.documentId, 'played');
        }
    }, [page, guide.documentId]);

    return (
        <aside className={styles.guide} aria-labelledby="first-run-heading">
            <header>
                <h2 id="first-run-heading">Share your first prototype</h2>
                <button type="button" aria-label="Close guide" onClick={closeFirstRunGuide}>
                    <X size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
            </header>
            <ol>
                <Step done={guide.edited} title="Make it yours">
                    <span>Click any text on a screen, then change its Text in the Inspector.</span>
                </Step>
                <Step done={guide.played} title="Play it">
                    <span>Click through the screens as people will.</span>
                    {page === 'editor' && (
                        <button type="button" onClick={() => navigate('/prototype')}>
                            Play prototype
                        </button>
                    )}
                </Step>
                <Step done={guide.shared} title="Share a link">
                    <span>
                        {page === 'editor'
                            ? 'In Prototype, choose Share.'
                            : 'Choose Share at the top right, then Create snapshot link.'}
                    </span>
                </Step>
            </ol>
            {guide.shared && (
                <p role="status">Your link is ready. Anyone with it can play your prototype.</p>
            )}
        </aside>
    );
}

/** The first-run guide, on the page of the document it follows. */
export function Guide({ page }: { page: 'editor' | 'prototype' }) {
    const guide = useFirstRunGuide();
    const documentId = useAppState((state) => state.currentDocumentId);

    return guide?.documentId === documentId ? <GuideCard guide={guide} page={page} /> : null;
}
