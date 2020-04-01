import React from 'react';
import getCentre from '../../../events/computed/centre';
import getRadius from '../../../events/computed/radius';
import styles from '../../styles.css';
import { useApp } from './src/app';

/**
 * Draws a circle based on input coords and radius

<circle 
    cx="the x-axis center of the circle" 
    cy="the y-axis center of the circle" 
    r="The circle's radius. Required." 
/>
**/

// Command
export function circle({ centre, radius, selected }) {
  return {
    name: 'Circle x',
    centre: centre,
    radius: radius,
    selected: true,
    type: 'circle'
  };
}

// Factory function
export function createCircle() {
  const options = {
    centre: getCentre(),
    radius: getRadius()
  };

  return circle(options);
}

// Pure component
export const Circle = ({ centre, radius, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <circle key="circle" className={className} cx={centre.x} cy={centre.y} r={radius} />;
};

// Connected component
export default connect(
  {
    centre: getCentre,
    radius: getRadius,
    shape: state`workspace.shapes.${props`id`}`
  },
  Circle
);
