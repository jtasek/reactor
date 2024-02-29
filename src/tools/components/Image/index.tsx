import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Position, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Pointer } from '../../../events/types';
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

interface Props {
    id?: string;
    key: string;
    name: string;
    position: Position;
    selected: boolean;
    size: Size;
    source: string;
    type: string;
}

export const createImageProps = (
    { startPosition, scaledStartPosition, size, scaledSize }: Pointer,
    designMode = false
): Props => {
    const name = designMode ? 'Image x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        name,
        position: designMode ? scaledStartPosition : startPosition,
        selected: true,
        size: designMode ? scaledSize : size,
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
            //width={width} - to maintain aspect ratio
            className={className}
            data-cy={name}
            height={size.height}
            key={key}
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
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('ImageCommand:execute');

        const shape = createImageProps(state.events.pointer, true);

        actions.addShape(shape);
    }
};

export const ImageTool: Tool = {
    id: 'image',
    name: 'Image',
    description: 'Insert an image',
    command: ImageCommand,
    component: Image,
    designComponent: DesignImage
};
