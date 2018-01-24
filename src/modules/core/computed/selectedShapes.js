import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`workspace.shapes`,
    (shapes) => (
        Object.keys(shapes).filter(key => shapes[key].selected)
    ))