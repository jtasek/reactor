import {v4} from 'uuid'

export default ({props, state}) => {
    const layer = state.get(`workspace.layers.${props.id}`)
    layer.id = v4()

    state.push(`workspace.layers.${layer.id}`, layer)

    output({ id: layer.id })
}