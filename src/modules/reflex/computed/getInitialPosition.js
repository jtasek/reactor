/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`reflex.monitor.initialPosition`,
    state`workspace.camera.scale`,
    (initial, scale) => ({
        x: initial.x / scale,
        y: initial.y / scale
    }))