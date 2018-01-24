/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`reflex.monitor.position`,
    state`reflex.monitor.initialPosition`,
    state`workspace.camera.scale`,
    (position, initialPosition, scale) => ({
        x: (position.x - initialPosition.x) / scale,
        y: (position.y - initialPosition.y) / scale
    }))