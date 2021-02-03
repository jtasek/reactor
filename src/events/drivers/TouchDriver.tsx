/* events:
onTouchCancel onTouchEnd onTouchMove onTouchStart */

import React, { FC, ComponentType } from 'react';
import { LogLevel } from 'ts-loader/dist/logger';

/* properties: 
boolean altKey
DOMTouchList changedTouches
boolean ctrlKey
boolean getModifierState(key)
boolean metaKey
boolean shiftKey
DOMTouchList targetTouches
DOMTouchList touches */

const log = (event) =>
  console.log(`clientX: ${event.target.clientX}, clientY: ${event.target.clientY}`);

export const withTouch = <P extends object>(Component: ComponentType<P>): FC<P> => (props: P) => (
  <Component
    {...props}
    displayName="withTouch"
    onTouchStart={log}
    onTouchMove={log}
    onTouchEnd={log}
  />
);
