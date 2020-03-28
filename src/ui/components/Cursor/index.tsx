// Change cursor style
import React from 'react';

export default connect(
  {
    position: state.events.pointer.position
  },
  ({ position }) => (
    <div
      style={{
        color: 'black',
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      x: {position.x}, y: {position.y}
    </div>
  )
);
