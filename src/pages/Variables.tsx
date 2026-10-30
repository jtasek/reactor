import React from 'react';
import { useAppState } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import { Variables } from 'src/ui/components/Variables/Variables';
import { registerEditor } from './registerEditor';
import { Viewer } from './Viewer';

// Direct visits need the same validated editing actions as the canvas.
registerEditor();

export function VariablesPage() {
    const readOnly = useAppState(isReadOnly);
    const checking = useAppState(
        (state) =>
            !state.documentAccess[state.currentDocumentId] ||
            state.documentAccess[state.currentDocumentId].role === 'unknown'
    );
    if (readOnly) {
        return <Viewer checking={checking} />;
    }

    return (
        <main>
            <Variables fullPage />
        </main>
    );
}
