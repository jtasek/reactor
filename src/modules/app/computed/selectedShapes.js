import { Compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default Compute(
    state`workspace.shapes`,
    (shapes) => (
        Object.keys(shapes).filter(key => shapes[key].selected)
    ))