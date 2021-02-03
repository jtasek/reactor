// mouse driver

import React, { FC, ComponentType } from 'react';

// register shortcuts

// register all commands from tools

/* events:
onClick onContextMenu onDoubleClick onDrag onDragEnd onDragEnter onDragExit
onDragLeave onDragOver onDragStart onDrop onMouseDown onMouseEnter onMouseLeave
onMouseMove onMouseOut onMouseOver onMouseUp */

/* properties: 
boolean altKey
number button
number buttons
number clientX
number clientY
boolean ctrlKey
boolean getModifierState(key)
boolean metaKey
number pageX
number pageY
DOMEventTarget relatedTarget
number screenX
number screenY
boolean shiftKey
*/

/* events 
onWheel */

/* properties:
number deltaMode
number deltaX
number deltaY
number deltaZ */
const log = (e) => {
  debugger;
  console.log(`clientX: ${e.target.clientX}, clientY: ${e.target.clientY}`);
};

export const withMouse = <P extends object>(Component: ComponentType<P>): FC<P> => (props: P) => (
  <Component
    {...props}
    displayName="withMouse"
    onMouseDown={log}
    onMousedMove={log}
    onMouseUp={log}
  />
);
