
import { Compute } from 'cerebral'
import { state } from 'cerebral'

export default Compute(
  state`reflex.monitor.position`,
  state`reflex.monitor.initialPosition`,
  state`workspace.camera.scale`,
  (position, initialPosition, scale) => ({
    x: (initialPosition.x + (position.x - initialPosition.x) / 2) / scale,
    y: (initialPosition.y + (position.y - initialPosition.y) / 2) / scale
  })
)
