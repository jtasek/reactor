import React, { FC, useEffect, useRef } from 'react';

import styles from './styles.css';
import { Command } from 'src/app/types';
import { useActions, useKeyboard, usePointer } from 'src/app/hooks';
import { Tool } from 'src/tools/types';
import { Handle } from 'src/ui/components/Handle';
import { Context } from '../../../app';

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

export function createTextProps({ state }: Context, designMode = false) {
  const { position, scaledPosition } = state.events.pointer;
  const { text } = state.events.keyboard;

  return {
    name: 'Text x',
    selected: true,
    type: 'text',
    value: text,
    x: designMode ? scaledPosition.x : position.x,
    y: designMode ? scaledPosition.y : position.y
  };
}

export const Text: FC<Props> = ({ name, x, y, value, selected, designMode }) => {
  const shape = useRef<HTMLInputElement | null>(null);
  const {
    startTyping: handleStartTyping,
    typing: handleTyping,
    endTyping: handleEndTyping
  } = useActions().events;

  if (designMode) {
    const lineHeight = 22;
    return (
      <text key={name} className={styles.input} x={x} y={y + lineHeight}>
        {value}hjoiljk
      </text>
    );
  }

  return (
    <g>
      <foreignObject width="100%" height="100%" x={x} y={y}>
        <form>
          <input
            ref={shape}
            autoFocus
            type="text"
            data-cy={name}
            className={styles.input}
            placeholder="Type something..."
            value={value}
            onFocus={() => handleStartTyping}
            onBlur={() => handleEndTyping}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEndTyping();
              }
            }}
            onChange={(e) => {
              e.preventDefault();
              // console.log('text bbox', shape.current?.getBBox());
              handleTyping();
              e.currentTarget.value;
            }}
          />
        </form>
      </foreignObject>
    </g>
  );
};

// export const DesignText: FC = () => {
//   const pointer = usePointer();
//   const keyboard = useKeyboard();

//   const { startTyping, typing, endTyping } = useActions().events;

//   const inputRef = useRef<HTMLInputElement | null>(null);
//   useEffect(() => {
//     inputRef?.current?.focus();
//   });

//   return (
//     <Text
//       {...createTextProps(pointer, keyboard)}
//       value={keyboard.text}
//       onStartTyping={startTyping}
//       onTyping={typing}
//       onEndTyping={endTyping}
//     />
//   );
// };

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
  canExecute: (context, ) => true,
  execute: (context) =>
    React.createElement(Text, { ...createTextProps(context), designMode: false } as Props, null),
  factory: (context: Context) => createTextProps(context, true)
};

export const TextTool: Tool = {
  id: 'text',
  name: 'Text',
  description: 'Type a text',
  command: TextCommand,
  component: Text
};
