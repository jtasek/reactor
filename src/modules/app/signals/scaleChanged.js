import { set } from 'cerebral/operators'
import { props, state } from 'cerebral'

export default [set(state`workspace.camera.scale`, props`scale`)]
