import {createLayer} from '../core/factories'

export default ({props, state}) => {
    const layer = createLayer(props)

    state.push(`workspace.layers.${layer.id}`, layer)

    output({ id: layer.id })
}