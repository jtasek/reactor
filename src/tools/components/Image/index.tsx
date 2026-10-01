import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point, Size } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from '../../../app/factories';
import { useImageToPlace, useImageUrl, usePointer } from '../../../app/hooks';
import type { ImageToPlace } from '../../../app/services/assets';
import { Context } from 'src/app';

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

interface Props {
    id?: string;
    name: string;
    position: Point;
    selected: boolean;
    size: Size;
    source: string;
    type: 'image';
}

const getImageBounds = (
    pointer: Pick<Pointer, 'start' | 'current'>,
    ratio: number
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

    // Lock the drag box to the image aspect ratio using the dominant drag axis,
    // so the box reaches the cursor without distorting the image.
    if (Math.abs(deltaX) >= Math.abs(deltaY) * ratio) {
        const width = Math.abs(deltaX);
        return toBounds(width, width / ratio);
    }

    const height = Math.abs(deltaY);
    return toBounds(height * ratio, height);
};

/** An image shape drawn by the drag, showing `image` at its own proportions. */
export const createImageProps = (
    pointer: Pointer,
    image: ImageToPlace,
    designMode = false
): Props => {
    const name = designMode ? 'Image x' : newShapeName();
    const { position, size } = getImageBounds(pointer, image.ratio);

    return {
        name,
        position,
        selected: true,
        size,
        source: image.source,
        type: 'image'
    };
};

export const Image: FC<Props> = ({ name, position, size, source, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    const url = useImageUrl(source);

    return (
        <image
            className={className}
            data-cy={name}
            height={size.height}
            preserveAspectRatio="xMidYMid meet"
            width={size.width}
            x={position.x}
            href={url}
            y={position.y}
        />
    );
};

export const DesignImage: FC = () => {
    const pointer = usePointer();
    const image = useImageToPlace();

    if (!pointer.dragging || !image) {
        return null;
    }

    const props = createImageProps(pointer, image, true);

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
    shortcut: 'i',
    canExecute: ({ state }) =>
        state.tools.imageToPlace !== undefined &&
        (state.events.pointer.size.width > 0 || state.events.pointer.size.height > 0),
    execute: ({ actions, state }) => {
        const image = state.tools.imageToPlace;

        if (image) {
            actions.addShape(createImageProps(state.events.pointer, image));
        }
    },
    shouldDeactivate: function (context: Context): boolean {
        return !context.state.events.pointer.dragging;
    }
};

export const ImageTool: Tool = {
    ...ImageCommand,
    // Choosing the tool asks for the image to draw.
    activate: ({ effects }) => {
        void effects.assets.pickImage();
    },
    component: Image,
    designComponent: DesignImage
};
