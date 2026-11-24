import React, { FC, useState } from 'react';
import { FEEDBACK_MAX_LENGTH } from 'src/shared/feedback';
import { SCHEMA_VERSION } from 'src/shared/schemaVersion';
import { TextArea } from '../Controls';
import { Dialog } from '../Dialog';
import styles from './styles.css';

/** Sends `message`; null once it is sent, otherwise why it was not. */
async function sendFeedback(message: string) {
    let response: Response;

    try {
        response = await fetch('/api/feedback', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message,
                page: window.location.pathname,
                release: `${SCHEMA_VERSION}`
            })
        });
    } catch {
        return 'The server could not be reached. Try again.';
    }

    if (response.ok) {
        return null;
    }

    return response.status === 429
        ? 'You sent a lot of feedback in the last hour. Try again later.'
        : 'Your feedback could not be sent. Try again.';
}

/** Sends a message to the people making Reactor; what was written stays when sending fails. */
export const FeedbackDialog: FC<{ onClose: () => void }> = ({ onClose }) => {
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [failure, setFailure] = useState<string>();

    const send = async () => {
        setBusy(true);
        setFailure(undefined);

        const problem = await sendFeedback(message);

        if (problem === null) {
            setSent(true);

            return;
        }

        setFailure(problem);
        setBusy(false);
    };

    if (sent) {
        return (
            <Dialog
                title="Thank you"
                description="Your feedback was sent. We may answer by email."
                visible
                onClose={onClose}
            />
        );
    }

    return (
        <Dialog
            title="Send feedback"
            description="Tell us what works, what doesn’t, or what you miss. We see your email address, the page and the app version with it."
            visible
            onClose={onClose}
            actions={
                <>
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        data-variant="primary"
                        disabled={busy || message.trim().length === 0}
                        onClick={send}
                    >
                        {busy ? 'Sending…' : 'Send'}
                    </button>
                </>
            }
        >
            <TextArea
                className={styles.message}
                label="Your feedback"
                rows={6}
                maxLength={FEEDBACK_MAX_LENGTH}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
            />
            {failure && <p role="alert">{failure}</p>}
        </Dialog>
    );
};
