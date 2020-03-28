
import { Compute } from 'cerebral'
import { state } from 'cerebral'

export default Compute(
  state`reflex.monitor.position`,
  state`reflex.monitor.initialPosition`,
  state`workspace.camera.scale`,
  (position, initialPosition, scale) => ({
    x: (position.x - initialPosition.x) / scale,
    y: (position.y - initialPosition.y) / scale
  })
)
