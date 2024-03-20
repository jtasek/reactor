import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point } from 'src/app/types';
import type { Pointer } from '../../../events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from '../../../app/factories';
import { stringifyPath } from 'src/app/utils';
import { usePointer } from '../../../app/hooks';

/**
 * Draws a line based on path

 <polyline points="the points on the polyline. Required." />

**/

interface Props {
    key: string;
    name: string;
    points: Point[];
    selected: true;
    type: 'pen';
}

export const createPenProps = ({ path, scaledPath }: Pointer, designMode = false): Props => {
    const name = designMode ? 'Pen x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        name,
        points: designMode ? scaledPath : path,
        selected: true,
        type: 'pen'
    };
};

export const Pen: FC<Props> = ({ key, name, points, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Pen');

    return (
        <polyline className={className} data-cy={name} key={key} points={stringifyPath(points)} />
    );
};

export const DesignPen: FC = () => {
    const pointer = usePointer();

    const props = createPenProps(pointer, true);

    return <Pen {...props} />;
};

export const PenCommand: Command = {
    id: 'pen',
    name: 'Pen',
    category: 'shapes',
    description: 'Draws a line',
    icon: {
        group: 'content',
        name: 'create',
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /(?<toolCode>pen)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
    shortcut: 'ctrl+p',
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('PenCommand:execute');

        const shape = createPenProps(state.events.pointer, true);

        actions.addShape(shape);
    }
};

export const PenTool: Tool = {
    ...PenCommand,
    component: Pen,
    designComponent: DesignPen
};
