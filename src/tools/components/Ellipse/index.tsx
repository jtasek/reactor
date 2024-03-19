import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Pointer } from '../../../events/types';
import { newShapeName } from '../../../app/factories';
import { usePointer } from '../../../app/hooks';

/**
 * Draws an ellipse based on input coords and size

<ellipse 
    cx="the x-axis center of the ellipse"
    cy="the y-axis center of the ellipse"
    rx="the length of the ellipse's radius along the x-axis. Required."
    ry="the length of the ellipse's radius along the y-axis. Required." 
/>
**/

interface Props {
    key: string;
    name: string;
    position: Point;
    radius: Point;
    selected: boolean;
    type: string;
}

export const createEllipseProps = (
    { center, scaledCenter, size, scaledSize }: Pointer,
    designMode = false
): Props => {
    const name = designMode ? 'Circle x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        position: designMode ? scaledCenter : center,
        radius: designMode
            ? { x: scaledSize.width, y: scaledSize.height }
            : { x: size.width, y: size.height },
        name,
        selected: true,
        type: 'ellipse'
    };
};

export const DesignEllipse: FC = () => {
    const pointer = usePointer();

    const props = createEllipseProps(pointer, true);

    return <Ellipse {...props} />;
};

export const Ellipse: FC<Props> = ({ key, name, position, radius, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Ellipse');

    return (
        <ellipse
            className={className}
            cx={position.x}
            cy={position.y}
            data-cy={name}
            key={key}
            rx={radius.x}
            ry={radius.y}
        />
    );
};

export const EllipseCommand: Command = {
    id: 'ellipse',
    name: 'Ellipse',
    category: 'shapes',
    description: 'Draws an elliptic shape',
    icon: {
        group: 'image',
        name: 'panorama_fish_eye',
        color: 'rgb(144, 254, 214)',
        size: 24
    },
    regex: /(?<toolCode>ellipse)\((?<cx>\d+),(?<cy>\d+),(?<rx>\d+),(?<ry>\d+)\)/,
    shortcut: 'ctrl+e',
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('EllipseCommand:execute');

        const shape = createEllipseProps(state.events.pointer, true);

        actions.addShape(shape);
    }
};

export const EllipseTool: Tool = {
    ...EllipseCommand,
    component: Ellipse,
    designComponent: DesignEllipse
};
