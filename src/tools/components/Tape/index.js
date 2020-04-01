import React from 'react';

import currentPosition from '../../../reflex/computed/getPosition';
import startPosition from '../../../reflex/computed/getInitialPosition';
import styles from '../../styles.css';

/**
 * Draws a line from start point to end point
 **/

// Command
export function line({ start, end }) {
  return {
    name: 'Tape x',
    start: start,
    end: end,
    selected: true,
    type: 'tape'
  };
}

// Factory function
export function createLine() {
  const options = {
    start: startPosition().get(),
    end: currentPosition().get()
  };

  return line(options);
}

// Pure component
export const Line = ({ start, end, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <line key="line" className={className} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
};

// Connected component
export default connect(
  ({ id }) => ({
    start: startPosition(),
    end: currentPosition(),
    shape: state`workspace.shapes.${props`id`}`
  }),
  Line
);
