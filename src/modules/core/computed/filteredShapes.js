import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`workspace.filter`,
    state`workspace.shapes`,
    (filter, shapes) => (
        Object.keys(shapes).filter(key => {
            const shape = shapes[key]
            return shape && shape.name && shape.name.includes(filter)
        })
    ))