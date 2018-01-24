/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'
import { Point } from '../../core/types'

export default compute(
    state`reflex.monitor.path`,
    state`workspace.camera.scale`,
    (path, scale) => path.map(point => `${point.x / scale}, ${point.y / scale}`)
)