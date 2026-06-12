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

// Intrinsic aspect ratio (width / height) of the source image, measured from the
// image itself so the drawn bounds match it exactly and the picture is never
// distorted or letterboxed. Null until the image has loaded and reported its
// natural dimensions.
let imageRatio: number | null = null;

if (typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
    const probe = new window.Image();
    probe.onload = () => {
        if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
            imageRatio = probe.naturalWidth / probe.naturalHeight;
        }
    };
    probe.src = DEFAULT_IMAGE;
}

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
    ratio = imageRatio
): { position: Point; size: Size } => {
    const { start, current } = pointer;
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;

    // Anchor the box at the drag start and grow toward the cursor — the same
    // normalized convention the rectangle tool uses (topLeft + size).
    const toBounds = (width: number, height: number): { position: Point; size: Size } => ({
        position: {
            x: deltaX < 0 ? start.x - width : start.x,
            y: deltaY < 0 ? start.y - height : start.y
        },
        size: { width, height }
    });

    // Intrinsic ratio not known yet — fall back to free-form bounds (rect tool).
    if (!ratio || ratio <= 0) {
        return toBounds(Math.abs(deltaX), Math.abs(deltaY));
    }

    // Lock the drag box to the image aspect ratio using the dominant drag axis,
    // so the box reaches the cursor without distorting the image.
    if (Math.abs(deltaX) >= Math.abs(deltaY) * ratio) {
        const width = Math.abs(deltaX);
        return toBounds(width, width / ratio);
    }

    const height = Math.abs(deltaY);
    return toBounds(height * ratio, height);
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
        const shape = createImageProps(state.events.pointer);

        actions.addShape(shape);
    }
};

export const ImageTool: Tool = {
    ...ImageCommand,
    component: Image,
    designComponent: DesignImage
};
