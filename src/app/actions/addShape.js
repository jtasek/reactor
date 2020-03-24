import {createShape} from '../app/factories'

export default ({props, state}) => {
    const shape = createShape(props)

    state.push(`workspace.shapes.${shape.id}`, shape)

    output({ id: shape.id })
}