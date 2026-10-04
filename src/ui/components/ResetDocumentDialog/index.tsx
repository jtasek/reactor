import React, { useEffect } from 'react';
import { useActions, useDocumentReset } from 'src/app/hooks';
import { Dialog } from '../Dialog';

export const ResetDocumentDialog = () => {
    const name = useDocumentReset();
    const { cancelDocumentReset, resetDocument } = useActions();

    useEffect(() => {
        if (name === undefined) cancelDocumentReset();
    }, [name, cancelDocumentReset]);

    return (
        <Dialog
            title="Reset document?"
            description={`Reset “${name}”? All shapes, layers, and other content will be removed.`}
            visible={name !== undefined}
            onClose={() => cancelDocumentReset()}
            actions={
                <>
                    <button type="button" onClick={() => cancelDocumentReset()}>
                        Cancel
                    </button>
                    <button type="button" data-variant="primary" onClick={() => resetDocument()}>
                        Reset document
                    </button>
                </>
            }
        />
    );
};
