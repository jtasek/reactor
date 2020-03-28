import {v4} from 'uuid'

export default ({props, state}) => {
    const ruler = state.get(`workspace.rulers.${props.id}`)
    ruler.id = v4()

    state.push(`workspace.rulers.${ruler.id}`, ruler)

    output({ id: ruler.id })
}