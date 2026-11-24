import React, { useEffect } from 'react';
import { useActions, useDocumentReset } from 'src/app/hooks';
import { Button } from '../Controls';
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
                    <Button onClick={() => cancelDocumentReset()}>Cancel</Button>
                    <Button kind="destructive" onClick={() => resetDocument()}>
                        Reset document
                    </Button>
                </>
            }
        />
    );
};
