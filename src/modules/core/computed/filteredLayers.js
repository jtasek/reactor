import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`workspace.filter`,
    state`workspace.layers`,
    (filter, layers) => (
        Object.keys(layers).filter(key => {
            const layer = layers[key]
            return layer && layer.name && layer.name.includes(filter)
        })
    ))