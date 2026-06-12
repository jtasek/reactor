import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point, Size } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from '../../../app/factories';
import { useActions, usePointer } from '../../../app/hooks';

/**
 * Insert image based on current coords
 * Select from library or upload to libraries
 
<image 
    x="the x-axis top-left corner of the image"
    y="the y-axis top-left corner of the image"
    width="the width of the image. Required."
    height="the height of the image. Required."
    xlink:href="the path to the image. Required." 
/>
 
 **/

const DEFAULT_IMAGE = '/images/avatar.jpg';
const DEFAULT_IMAGE_RATIO = 1;

interface Props {
    id?: string;
    key: string;
    name: string;
    position: Point;
    selected: boolean;
    size: Size;
    source: string;
    type: 'image';
}

const getImageBounds = (
    pointer: Pick<Pointer, 'start' | 'current'>,
    ratio = DEFAULT_IMAGE_RATIO
): { position: Point; size: Size } => {
    const { start, current } = pointer;
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;

    const dragByWidth = Math.abs(deltaX) >= Math.abs(deltaY);

    let width = 0;
    let height = 0;

    if (dragByWidth) {
        width = Math.abs(deltaX);
        height = width / ratio;
    } else {
        height = Math.abs(deltaY);
        width = height * ratio;
    }

    let x = deltaX < 0 ? start.x - width : start.x;
    let y = deltaY < 0 ? start.y - height : start.y;

    // Special case requested: dragging left while cursor is below start
    // keeps the start point as the image bottom-left corner.
    if (deltaX < 0 && deltaY > 0) {
        x = start.x - width;
        y = start.y - height;
    }

    return {
        position: { x, y },
        size: { width, height }
    };
};

export const createImageProps = (pointer: Pointer, designMode = false): Props => {
    const name = designMode ? 'Image x' : newShapeName();
    const key = name.toLowerCase();
    const { position, size } = getImageBounds(pointer);

    return {
        key,
        name,
        position,
        selected: true,
        size,
        source: DEFAULT_IMAGE,
        type: 'image'
    };
};

export const Image: FC<Props> = ({ key, name, position, size, source, selected, id }) => {
    const actions = useActions();
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Image');

    return (
        <image
            className={className}
            data-cy={name}
            height={size.height}
            key={key}
            preserveAspectRatio="xMidYMid meet"
            width={size.width}
            x={position.x}
            xlinkHref={source}
            y={position.y}
            onClick={() => {
                actions.toggleShapeSelected(id!);
            }}
        />
    );
};

export const DesignImage: FC = () => {
    const pointer = usePointer();
    if (!pointer.dragging) {
        return null;
    }

    const props = createImageProps(pointer, true);

    return <Image {...props} />;
};

export const ImageCommand: Command = {
    id: 'image',
    name: 'Image',
    category: 'shapes',
    description: 'Draws an image shape',
    icon: {
        group: 'image',
        name: 'image',
        color: 'rgb(234, 2, 130)',
        size: 24
    },
    regex: /(?<toolCode>image)\('(?<protocol>www|http|https):\/\/(?<url>[^\s]+[\w])'\)/,
    shortcut: 'ctrl+i',
    canExecute: ({ state }) =>
        state.events.pointer.size.width > 0 || state.events.pointer.size.height > 0,
    execute: ({ actions, state }) => {
        console.log('ImageCommand:execute');

        const shape = createImageProps(state.events.pointer);

        actions.addShape(shape);
    }
};

export const ImageTool: Tool = {
    ...ImageCommand,
    component: Image,
    designComponent: DesignImage
};
