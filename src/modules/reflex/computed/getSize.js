/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`reflex.monitor.position`,
    state`reflex.monitor.initialPosition`,
    state`workspace.camera.scale`,
    (position, initialPosition, scale) => ({
        width: Math.abs(position.x - initialPosition.x) / scale,
        height: Math.abs(position.y - initialPosition.y) / scale
    })
)