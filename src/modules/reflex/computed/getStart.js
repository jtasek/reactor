/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`reflex.monitor.position`,
    state`reflex.monitor.initialPosition`,
    state`workspace.camera.scale`,
    (position, initialPosition, scale) => ({
        x: initialPosition.x > position.x ? position.x / scale : initialPosition.x / scale,
        y: initialPosition.y > position.y ? position.y / scale : initialPosition.y / scale
    }))