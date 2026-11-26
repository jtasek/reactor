import { Label } from 'src/ui/components/Label';
import { Pencil as PencilIcon } from 'lucide-react';
import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, PathPoint } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { pathData } from 'src/app/pathGeometry';
import { smoothStroke } from 'src/app/pathSmoothing';
import { usePointer } from 'src/app/hooks';
import { Context } from 'src/app';

/** Draws a path: straight between points, curved where a handle bends it. */

interface Props {
    closed?: true;
    name?: string;
    points: PathPoint[];
    selected: boolean;
    type: 'path';
}

export const createPencilProps = ({ path }: Pointer, designMode = false): Props => {
    const name = designMode ? 'Pencil x' : undefined;
    const points = path.map(({ x, y }) => ({ x, y }));

    return {
        name,
        points,
        selected: true,
        type: 'path'
    };
};

export const Path: FC<Props> = ({ closed, name, points, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

    return <path className={className} data-cy={name} d={pathData({ points, closed })} />;
};

export const DesignPencil: FC = () => {
    const pointer = usePointer();
    if (!pointer.dragging) {
        return null;
    }

    const props = createPencilProps(pointer, true);

    return (
        <>
            <Path {...props} />
            <Label shape={props} />
        </>
    );
};

export const PencilCommand: Command = {
    id: 'pencil',
    name: 'Pencil',
    category: 'shapes',
    description: 'Draws a freehand line',
    icon: {
        component: PencilIcon,
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /(?<toolCode>pen)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
    shortcut: 'p',
    canExecute: ({ state }) =>
        state.events.pointer.size.width > 0 || state.events.pointer.size.height > 0,
    execute: ({ actions, state }) => {
        const shape = createPencilProps(state.events.pointer);
        const points = smoothStroke(
            shape.points,
            state.tools.pencilSmoothing,
            state.currentDocument.camera.scale
        );

        actions.drawShape({ ...shape, points });
    },
    shouldDeactivate: function (context: Context): boolean {
        return !context.state.events.pointer.dragging;
    }
};

export const PencilTool: Tool = {
    ...PencilCommand,
    component: Path,
    draws: 'path',
    designComponent: DesignPencil
};
