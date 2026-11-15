import React, { FC, useEffect, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import {
    MAX_MOVE_BYTES,
    keepSignedOutDocuments,
    listSignedOutDocuments,
    moveSignedOutDocuments,
    tooLarge,
    type SignedOutDocument
} from 'src/app/services/signedOutDocuments';
import { formatSize } from 'src/app/services/documentSize';
import { Dialog } from '../Dialog';
import styles from './styles.css';

const size = formatSize;

const count = (documents: unknown[]) =>
    documents.length === 1 ? 'one document' : `${documents.length} documents`;

/**
 * Offers `owner` the documents this browser keeps signed out, once: Move adds them
 * to the account with their images, so they open wherever the person signs in;
 * Keep leaves them here, shown again once signed out. One over the size the server
 * takes in its first sync stays here either way.
 */
export const MoveDocuments: FC<{ owner: string }> = ({ owner }) => {
    const effects = useEffects();
    const { displayError, displaySuccess } = useActions();
    const held = useAppState((state) => state.documents);
    const [documents, setDocuments] = useState<SignedOutDocument[]>([]);
    const [moving, setMoving] = useState(false);

    useEffect(() => {
        let current = true;

        listSignedOutDocuments(effects, owner, (id) => Object.hasOwn(held, id)).then(
            (found) => current && setDocuments(found),
            () => {
                // Without this browser's signed-out documents, there is nothing to offer.
            }
        );

        return () => {
            current = false;
        };
        // Read once per account, when signed in; documents added later are the account's own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [owner]);

    if (documents.length === 0) {
        return null;
    }

    const movable = documents.filter((document) => !tooLarge(document));

    const keep = () => {
        keepSignedOutDocuments(effects, owner, documents);
        setDocuments([]);
    };

    // Escape only puts the question off: it is asked again on the next start.
    const dismiss = () => {
        if (!moving) setDocuments([]);
    };

    const move = async () => {
        setMoving(true);

        const {
            moved,
            tooLarge: kept,
            failed
        } = await moveSignedOutDocuments(effects, owner, documents);

        setDocuments([]);

        if (moved.length > 0) {
            // This copy catches up as when the tab is shown again, so it opens the
            // moved documents and creates them on the server.
            document.dispatchEvent(new Event('visibilitychange'));
            displaySuccess(
                `Moved ${count(moved)} into your account${kept.length > 0 ? `; ${count(kept)} too large to move stayed in this browser` : ''}.`
            );
        }

        if (failed.length > 0) {
            displayError(
                `${failed.length === 1 ? 'One document' : `${failed.length} documents`} could not be moved and stayed in this browser. You are asked again next time you sign in.`
            );
        }
    };

    return (
        <Dialog
            title="Move documents into your account?"
            description={`This browser keeps ${count(documents)} you made while signed out. Moved into your account, with their images, they open wherever you sign in. Kept here, they show again when you sign out.`}
            visible
            onClose={dismiss}
            actions={
                <>
                    <button type="button" disabled={moving} onClick={keep}>
                        Keep in this browser
                    </button>
                    {movable.length > 0 && (
                        <button
                            type="button"
                            data-variant="primary"
                            disabled={moving}
                            onClick={() => void move()}
                        >
                            {moving
                                ? 'Moving…'
                                : movable.length === 1
                                  ? 'Move document'
                                  : `Move ${movable.length} documents`}
                        </button>
                    )}
                </>
            }
        >
            <ul className={styles.documents} aria-label="Documents in this browser">
                {documents.map((document) => (
                    <li key={document.id}>
                        <span>{document.name}</span>
                        {tooLarge(document) && (
                            <small>
                                Too large to move: {size(document.bytes)}, over the{' '}
                                {size(MAX_MOVE_BYTES)} limit. It stays in this browser.
                            </small>
                        )}
                    </li>
                ))}
            </ul>
        </Dialog>
    );
};
