/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`reflex.monitor.position`,
    state`workspace.camera.scale`,
    (current, scale) => ({
        x: current.x / scale,
        y: current.y / scale
    }))