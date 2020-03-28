import React from 'react';

import getSize from '../../../events/computed/size';
import getStart from '../../../events/computed/start';
import styles from '../../styles.css';

/**
 * Draws a rectange based on position and size
 
 <rect 
    x="the x-axis top-left corner of the rectangle"
    y="the y-axis top-left corner of the rectangle"
    rx="the x-axis radius (to round the element)"
    ry="the y-axis radius (to round the element)" 
    width="the width of the rectangle. Required."
    height="the height of the rectangle Required." 
/>
**/

// Factory function
export function rectangle({ position, size, radius = 0 }) {
  return {
    name: 'Rectangle x',
    position: position,
    radius: radius,
    size: size,
    selected: true,
    type: 'rect'
  };
}

// Command
export function createRectangle() {
  const options = {
    position: getStart(),
    size: getSize()
  };

  return rectangle(options);
}

// Pure component
const Rect = ({ shape }) => {
  let className = shape.selected
    ? styles.shape + ' ' + styles.selected
    : styles.shape;

  return (
    <rect
      className={className}
      x={shape.position.x}
      y={shape.position.y}
      width={shape.size.width}
      height={shape.size.height}
      rx={shape.radius}
      ry={shape.radius}
    />
  );
};

// Connected component design mode
export const DynamicRectangle = connect(
  {
    position: getStart,
    size: getSize
  },
  props => {
    const shape = rectangle(props);

    return <Rect key="rect-design" shape={shape} />;
  }
);

export default DynamicRectangle;

// Connected component static
export const Rectangle = connect(
  {
    shape: state`workspace.shapes.${props`id`}`
  },
  ({ shape }) => <Rect key={shape.id} shape={shape} />
);
