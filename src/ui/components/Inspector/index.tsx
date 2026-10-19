import React, { FC, useRef } from 'react';

import { FrameInspector } from './FrameInspector';
import { Inspector } from './Inspector';
import { useActions, useAppState, useSelectedShapesProperties } from 'src/app/hooks';
import { useSelectedVariables, useTextTemplateProblems, useVariables } from 'src/app/variableHooks';
import { selectionIdentity, type SelectionIdentity } from '../selectionIdentity';

const cannotShow = (names: string[]) => `Cannot show ${names.join(', ')}`;

export const InspectorContainer: FC = () => {
    const selectedFrameId = useAppState((state) => state.currentDocument.selectedFrameId);
    const rows = useSelectedShapesProperties();
    const heldSelection = useRef<{ shapeIds: string[]; identity: SelectionIdentity | null }>({
        shapeIds: [],
        identity: null
    });
    const selection = useAppState((state) => {
        if (state.events.pointer.gesture.kind !== 'idle') {
            return heldSelection.current;
        }

        const document = state.currentDocument;

        heldSelection.current = {
            shapeIds: [...document.selectedShapesIds],
            identity: selectionIdentity(document)
        };

        return heldSelection.current;
    });
    const variables = useVariables();
    const bound = useSelectedVariables();
    const problems = useTextTemplateProblems();
    const { bindProperty, setShapesProperty, unbindProperty } = useActions();

    if (selectedFrameId) {
        return <FrameInspector key={selectedFrameId} id={selectedFrameId} />;
    }

    return (
        <Inspector
            rows={rows}
            shapeIds={selection.shapeIds}
            identity={selection.identity}
            onChange={(shapeIds, key, value) => setShapesProperty({ shapeIds, key, value })}
            variables={variables}
            bound={bound}
            notes={problems.length > 0 ? { text: cannotShow(problems) } : {}}
            onBind={(shapeIds, key, variableId) => bindProperty({ shapeIds, key, variableId })}
            onUnbind={(shapeIds, key) => unbindProperty({ shapeIds, key })}
        />
    );
};
