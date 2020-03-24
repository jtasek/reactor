/* @flow */
import { Compute } from 'cerebral'
import { state } from 'cerebral'
import { Point } from '../../app/types'

export default Compute(
  state`reflex.monitor.path`,
  state`workspace.camera.scale`,
  (path, scale) => path.map(point => `${point.x / scale}, ${point.y / scale}`)
)
