import React, { FC, useState } from 'react';
import { Pointer } from 'src/events/types';
import { useState as useAppState } from 'src/app/hooks';

import styles from '../../styles.css';

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
  onChange: (value: string) => void;
}

export const createText = ({ position }: Pointer): Props => {
  return {
    x: position.x,
    y: position.y,
    name: 'Text x',
    selected: true,
    type: 'text',
    value: '',
    onChange: () => {
      console.log('not implemented');
    }
  };
};

export const Text: FC<Props> = ({ name, x, y, value, onChange }) => (
  /*<text key="text" style={inlineStyles} x={position.x} y={position.y}>Tohle je test string</text>*/
  <g>
    <foreignObject width="100%" height="100%" x={x} y={y}>
      <form>
        <input
          type="text"
          data-cy={name}
          className="text-layer-input"
          placeholder="Type something..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </form>
    </foreignObject>
  </g>
);

export const DesignText: FC = () => {
  const { pointer } = useAppState().events;
  const [value, setValue] = useState<string>('');

  return <Text {...createText(pointer)} value={value} onChange={(value) => setValue(value)} />;
};
