import {createRuler} from '../core/factories'

export default ({props, state}) => {
    const ruler = createRuler(props)

    state.push(`workspace.rulers.${ruler.id}`, ruler)

    output({ id: ruler.id })
}