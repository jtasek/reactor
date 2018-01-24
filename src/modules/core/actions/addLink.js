import {createLink} from '../core/factories'

export default ({props, state}) => {
    const link = createLink(props)

    state.push(`workspace.links.${link.id}`, link)

    output({ id: link.id })
}