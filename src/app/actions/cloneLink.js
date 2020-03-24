import {v4} from 'uuid'

export default ({props, state}) => {
    const link = state.get(`workspace.links.${props.id}`)
    link.id = v4()

    state.push(`workspace.links.${link.id}`, link)

    output({ id: link.id })
}