import React, { ChangeEvent, FC, FormEvent, KeyboardEvent, useEffect, useRef } from 'react';

import styles from './styles.css';
import type { Command, Point } from 'src/app/types';
import type { Keyboard, Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from 'src/app/factories';
import { DEFAULT_TEXT_FONT_SIZE } from 'src/app/utils';
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
    fontSize: number;
    key: string;
    name: string;
    position: Point;
    selected: boolean;
    type: 'text';
    value: string;
}

export const createTextProps = (
    { start }: Pointer,
    { text }: Keyboard,
    designMode = false
): Props => {
    const name = designMode ? 'Text x' : newShapeName();
    const key = name.toLowerCase();

    return {
        fontSize: DEFAULT_TEXT_FONT_SIZE,
        key,
        name,
        position: start,
        selected: true,
        type: 'text',
        value: text
    };
};

export const Text: FC<Props> = ({ fontSize, key, name, position, value, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

    return (
        <text
            className={className}
            data-cy={name}
            key={key}
            style={{ fontSize }}
            x={position.x}
            y={position.y}
        >
            {value}
        </text>
    );
};

export const DesignText: FC = () => {
    const inputRef = useRef<HTMLInputElement>(null);

    const keyboard = useKeyboard();
    const pointer = usePointer();
    const actions = useActions();

    const { fontSize, name, position, value } = createTextProps(pointer, keyboard, true);

    // Focus the input once the location has been set (typing mode is started by the
    // placement click) and whenever it is repositioned.
    useEffect(() => {
        if (keyboard.typing) {
            inputRef.current?.focus();
        }
    }, [keyboard.typing, position.x, position.y]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        actions.events.typing(event.currentTarget.value);
    };

    const commit = () => {
        // Persist the text shape (no-op for empty text), then leave typing mode and
        // let resetTools deactivate the tool.
        actions.tools.executeToolCommands();
        actions.events.endTyping();
        actions.tools.resetTools();
    };

    const cancel = () => {
        actions.events.endTyping();
        actions.tools.resetTools();
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        commit();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
        }
    };

    // The input appears only after the user clicks the canvas to set the location.
    if (!keyboard.typing) {
        return null;
    }

    return (
        <foreignObject x={position.x} y={position.y - fontSize} width={300} height={fontSize * 2}>
            <form onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    className={styles.shape}
                    data-cy={name}
                    placeholder="Type something..."
                    style={{ fontSize }}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                />
            </form>
        </foreignObject>
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
    canExecute: () => true,
    execute: ({ actions, state }) => {
        const { keyboard, pointer } = state.events;

        // First canvas click only sets the location and enters typing mode — it does
        // not yet create a shape.
        if (!keyboard.typing) {
            actions.events.startTyping();
            return;
        }

        // Commit (Enter) persists the typed text at the chosen location.
        if (keyboard.text.length > 0) {
            actions.addShape(createTextProps(pointer, keyboard));
        }
    },
    shouldDeactivate: ({
        state: {
            events: { keyboard }
        }
    }) => {
        // Stay active while typing; deactivate once typing has ended.
        return !keyboard.typing;
    }
};

export const TextTool: Tool = {
    ...TextCommand,
    component: Text,
    designComponent: DesignText
};
