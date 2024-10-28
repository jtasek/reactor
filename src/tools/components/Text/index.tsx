import React, { FC, useEffect, useRef, useState } from 'react';

import styles from './styles.css';
import type { Command, Point } from 'src/app/types';
import type { Keyboard, Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from 'src/app/factories';
import { useActions, useKeyboard, usePointer } from 'src/app/hooks';

/**
 * Draws a text in current position

<text 
    x="a list of x-axis positions. The nth x-axis position is given to the nth character in the text. If there are additional characters after the positions run out they are placed after the last character. 0 is default"
    y="a list of y-axis positions. (see x). 0 is default"
    dx="a list of lengths which moves the characters relative to the absolute position of the last glyph drawn. (see x)"
    dy="a list of lengths which moves the characters relative to the absolute position of the last glyph drawn. (see x)" 
    rotate="a list of rotations. The nth rotation is performed on the nth character. Additional characters are NOT given the last rotation value"
    textLength="a target length for the text that the SVG viewer will attempt to display the text between by adjusting the spacing and/or the glyphs. (default: The text's normal length)"
    lengthAdjust="tells the viewer what to adjust to try to accomplish rendering the text if the length is specified. The two values are 'spacing' and 'spacingAndGlyphs'" 
/>

**/

interface Props {
    key: string;
    name: string;
    position: Point;
    selected: boolean;
    type: 'text';
    value: string;
}

export const createTextProps = (
    { current, scaledCurrent }: Pointer,
    { text }: Keyboard,
    designMode = false
): Props => {
    const name = designMode ? 'Text x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        name,
        position: designMode ? scaledCurrent : current,
        selected: true,
        type: 'text',
        value: text,
    };
}

export const Text: FC<Props> = ({ key, name, position, value, selected }) => {
    const lineHeight = 22;
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Text');

    return (
        <text
            className={className}
            data-cy={name}
            key={key}
            x={position.x}
            y={position.y + lineHeight}
        >
            {value}
        </text>
    );
};

export const DesignText: FC = () => {
    const shapeRef = useRef<HTMLInputElement>(null);
    const pointer = usePointer();
    const keyboard = useKeyboard();
    const {
        events: { startTyping, typing, endTyping }
    } = useActions();

    useEffect(() => {
        //shapeRef?.current?.focus();
        startTyping();
    }, []);

    const { key, name, position, value, type } = createTextProps(pointer, keyboard);

    const handleBlur = (event) => {
        event.preventDefault();
        endTyping();
    }

    const handleChange = (event) => {
        event.preventDefault();
        typing(event.currentTarget.value);
    }

    const handleKeyUp = (event) => {
        event.preventDefault();
        if (event.key === 'Enter') {
            endTyping();
        }
    }

    const handleSubmit = (event) => {
        event?.preventDefault();
        return false;
    }

    return (
        <g>
            <foreignObject width="100%" height="100%" x={position.x} y={position.y}>
                <form onSubmit={handleSubmit}>
                    <input
                        autoFocus
                        className={styles.shape}
                        data-cy={name}
                        key={key}
                        placeholder="Type something..."
                        ref={shapeRef}
                        type={type}
                        value={value}
                        onBlur={handleBlur}
                        onKeyUp={handleKeyUp}
                        onChange={handleChange}
                    />
                </form>
            </foreignObject>
        </g>
    );
};

export const TextCommand: Command = {
    id: 'text',
    name: 'Text',
    category: 'shapes',
    description: 'Type a text',
    icon: {
        group: 'editor',
        name: 'title',
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /(?<toolCode>text)\((?<x>[\d]+),(?<y>[\d]+),'(?<text>[\w]+)'\)/,
    shortcut: 't',
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('TextCommand:execute');

        const shape = createTextProps(state.events.pointer, state.events.keyboard, true);

        actions.addShape(shape);
    }
};

export const TextTool: Tool = {
    ...TextCommand,
    component: Text,
    designComponent: DesignText
};
