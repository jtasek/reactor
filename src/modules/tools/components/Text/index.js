import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'
import styles from '../../styles.css'
import currentPosition from '../../../reflex/computed/getPosition'

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
export const Text = ({ position }) => (
  /*<text key="text" style={inlineStyles} x={position.x} y={position.y}>Tohle je test string</text>*/
  <g>
    <foreignObject width="100%" height="100%" x={position.x} y={position.y}>
      <form>
        <input
          type="text"
          className="text-layer-input"
          placeholder="Type something..."
          value="Tohle je test string"
        />
      </form>
    </foreignObject>
  </g>
)

export default connect(
  {
    position: currentPosition,
    shape: state`workspace.shapes.${props`id`}`
  },
  Text
)
