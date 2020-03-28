// Change cursor style
import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'

export default connect(
  {
    position: state`reflex.monitor.position`
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
)
