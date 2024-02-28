import React, { FC } from 'react';
import { useTools } from 'src/app/hooks';
import { Tool } from './Tool';

export const Stack: FC = () => {
    const { activeToolsIds } = useTools();
    console.log('stack render', activeToolsIds);

    return (
        <g id="tools">
            {activeToolsIds.map((toolId) => (
                <Tool key={toolId} toolId={toolId} />
            ))}
        </g>
    );
};
