import React, { FC, Suspense, lazy, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Icon } from '../Icon';

const FeedbackDialog = lazy(() =>
    import('./FeedbackDialog').then((module) => ({ default: module.FeedbackDialog }))
);

/** A button that opens Send feedback; the dialog loads when it is first opened. */
export const SendFeedback: FC<{ className: string }> = ({ className }) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                className={className}
                type="button"
                aria-label="Send feedback"
                title="Send feedback"
                onClick={() => setOpen(true)}
            >
                <Icon icon={{ component: MessageSquare, size: 20 }} />
            </button>
            {open && (
                <Suspense fallback={null}>
                    <FeedbackDialog onClose={() => setOpen(false)} />
                </Suspense>
            )}
        </>
    );
};
