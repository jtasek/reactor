import {v4} from 'uuid'

export default ({props, state}) => {
    const group = state.get(`workspace.groups.${props.id}`)
    group.id = v4()

    state.push(`workspace.groups.${group.id}`, group)

    output({ id: group.id })
}