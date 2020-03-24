/* @flow */
import { Compute } from 'cerebral'
import { state } from 'cerebral'

export default Compute(
  state`reflex.monitor.initialPosition`,
  state`workspace.camera.scale`,
  (initial, scale) => ({
    x: initial.x / scale,
    y: initial.y / scale
  })
)
