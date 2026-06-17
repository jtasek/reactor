import React, { FC } from 'react';
import { useTools } from 'src/app/hooks';
import { Tool } from './Tool';

export const Stack: FC = () => {
    const { activeToolsIds } = useTools();

    return (
        <g id="tools">
            {activeToolsIds.map((toolId: string) => (
                <Tool key={toolId} toolId={toolId} />
            ))}
        </g>
    );
};
