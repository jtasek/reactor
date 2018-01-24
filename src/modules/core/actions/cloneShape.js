import {v4} from 'uuid'

export default ({props, state}) => {
    const shape = state.get(`workspace.shapes.${props.id}`)
    shape.id = v4()

    state.push(`workspace.shapes.${shape.id}`, shape)

    output({ id: shape.id })
}