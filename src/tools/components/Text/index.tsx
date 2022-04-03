import React, { FC, useEffect, useRef } from 'react';
import { Position } from 'src/app/types';

import { useActions, useAppState as useAppState } from 'src/app/hooks';

import styles from './styles.css';
import { Keyboard, Pointer } from 'src/events/types';
import { Tool } from 'src/tools/types';

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
  name: string;
  x: number;
  y: number;
  value: string;
  selected: boolean;
  type: string;
  onStartTyping: () => void;
  onTyping: (value: string) => void;
  onEndTyping: () => void;
}

export function createText(
  { position }: Pointer,
  { text }: Keyboard
): Pick<Props, 'name' | 'x' | 'y' | 'value' | 'selected' | 'type'> {
  return {
    x: position.x,
    y: position.y,
    name: 'Text x',
    selected: true,
    type: 'text',
    value: text
  };
}

export const Text: FC<Props> = ({
  name,
  x,
  y,
  value,
  selected,
  onStartTyping,
  onTyping,
  onEndTyping
}) => {
  if (!selected) {
    const lineHeight = 22;
    return (
      <text key={name} className={styles.input} x={x} y={y + lineHeight}>
        {value}
      </text>
    );
  }

  return (
    <g>
      <foreignObject width="100%" height="100%" x={x} y={y}>
        <form>
          <input
            autoFocus
            type="text"
            data-cy={name}
            className={styles.input}
            placeholder="Type something..."
            value={value}
            onFocus={(e) => onStartTyping()}
            onBlur={(e) => onEndTyping()}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEndTyping();
              }
            }}
            onChange={(e) => {
              e.preventDefault();
              onTyping(e.currentTarget.value);
            }}
          />
        </form>
      </foreignObject>
    </g>
  );
};

export const TextTool: FC = () => {
  const { pointer, keyboard } = useAppState().events;
  const { startTyping, typing, endTyping } = useActions().events;
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef?.current?.focus();
  });

  return (
    <Text
      {...createText(pointer, keyboard)}
      value={keyboard.text}
      onStartTyping={startTyping}
      onTyping={typing}
      onEndTyping={endTyping}
    />
  );
};

export const TextCommand: Tool = {
  id: 'text',
  name: 'Text',
  description: 'Type a text',
  factory: createText,
  tool: TextTool,
  component: Text,
  icon: {
    group: 'editor',
    name: 'title',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>text)\((?<x>[\d]+),(?<y>[\d]+),'(?<text>[\w]+)'\)/,
  shortcut: 't'
};
