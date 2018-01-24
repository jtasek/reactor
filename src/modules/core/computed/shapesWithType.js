/* @flow */
import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`workspace.filter`,
    state`workspace.shapes`,
    (filter, shapes) => (
        Object.keys(shapes).map(key => {
            const shape = shapes[key]
            return {
                id: shape.id,
                type: shape.type
            }
        })
    )
)